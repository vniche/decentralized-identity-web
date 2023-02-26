package main

import (
	"crypto/ecdsa"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	jose "github.com/go-jose/go-jose/v3"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	_ "github.com/joho/godotenv/autoload"
	"github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

var (
	privateKey    *rsa.PrivateKey
	sessionSecret string
	targetDomain  string
	redirectURI   string
)

func init() {
	var err error
	pkPath, ok := os.LookupEnv("PRIVATE_KEY_PATH")
	if !ok {
		panic("PRIVATE_KEY_PATH env var is required")
	}

	privateKeyFile, err := os.ReadFile(pkPath)
	if err != nil {
		log.Fatal(fmt.Errorf("unable to load private key from file: %w", err))
	}

	block, _ := pem.Decode(privateKeyFile)
	if block == nil {
		log.Fatal(errors.New("unable to decode private key file"))
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		log.Fatal(fmt.Errorf("unable to parse private key: %w", err))
	}
	privateKey = key.(*rsa.PrivateKey)

	sessionSecret, ok = os.LookupEnv("SESSION_SECRET")
	if !ok {
		log.Fatal("SESSION_SECRET env var is required")
	}

	redirectURI, ok = os.LookupEnv("REDIRECT_URI")
	if !ok {
		log.Fatal("REDIRECT_URI env var is required")
	}

	url, err := url.Parse(redirectURI)
	if err != nil {
		log.Fatal(err)
	}

	targetDomain = strings.TrimPrefix(url.Hostname(), "www.")
}

type Error struct {
	Message string `json:"message"`
}

func wrapError(err error) Error {
	return Error{
		Message: err.Error(),
	}
}

func main() {
	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{redirectURI},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType},
		AllowMethods:     []string{http.MethodGet, http.MethodOptions},
		AllowCredentials: true,
	}))
	e.Use(session.Middleware(sessions.NewCookieStore([]byte(sessionSecret))))

	v1 := e.Group("/v1")
	v1.GET("/me", me)
	v1.GET("/authenticate", authenticate)

	e.Logger.Fatal(e.Start(":1323"))
}

type Wallet struct {
	Address string `json:"address"`
}

func me(c echo.Context) error {
	e := c.Echo()

	sessionCookie, err := c.Request().Cookie("WALLET_SESSION_ID")
	if err != nil && sessionCookie == nil {
		customErr := errors.New("no active session found")
		e.Logger.Errorf("%s: %w", customErr.Error(), err)
		return c.JSON(http.StatusForbidden, wrapError(customErr))
	}

	sess, err := session.Get("WALLET_SESSION", c)
	if err != nil {
		customErr := errors.New("no active session found")
		e.Logger.Errorf("%s: %w", customErr.Error(), err)
		return c.JSON(http.StatusForbidden, wrapError(customErr))
	}

	addressInterface, ok := sess.Values["WALLET_ADDRESS"]
	if !ok {
		err = errors.New("wallet address not found in session")
		e.Logger.Error(err)
		return c.JSON(http.StatusInternalServerError, wrapError(err))
	}

	address := addressInterface.(string)

	return c.JSON(http.StatusOK, &Wallet{
		Address: fmt.Sprintf("%s...%s", address[:8], address[len(address)-8:]),
	})
}

type Payload struct {
	Address   string `json:"address"`
	Signature string `json:"signature"`
}

func authenticate(c echo.Context) error {
	e := c.Echo()
	params := c.QueryParams()
	jweRaw := params.Get("jwe")
	if jweRaw == "" {
		return c.JSON(http.StatusBadRequest, errors.New("jwe query param is required but is not present or empty"))
	}

	decrypted, err := decryptJWE(jweRaw)
	if err != nil {
		e.Logger.Error(fmt.Errorf("malformed payload: %w", err))
		return c.JSON(http.StatusForbidden, wrapError(fmt.Errorf("malformed payload: %w", err)))
	}

	var payload Payload
	err = json.Unmarshal(decrypted, &payload)
	if err != nil {
		e.Logger.Error(fmt.Errorf("malformed payload: %w", err))
		return c.JSON(http.StatusForbidden, wrapError(fmt.Errorf("malformed payload: %w", err)))
	}

	address, err := verifySignatureAndGetAddress(payload.Address, payload.Signature)
	if err != nil {
		customErr := errors.New("failed to verify signature")
		e.Logger.Error(fmt.Errorf("%s: %w", customErr.Error(), err))
		return c.JSON(http.StatusForbidden, wrapError(customErr))
	}

	if address.Hex() != payload.Address {
		e.Logger.Error(errors.New("signature does not match requesting address"))
		return c.JSON(http.StatusForbidden, wrapError(errors.New("signature does not match requesting address")))
	}

	sessionCookie, err := c.Request().Cookie("WALLET_SESSION_ID")
	if err == nil && sessionCookie != nil {
		return c.Redirect(http.StatusMovedPermanently, redirectURI)
	}

	err = initiateSession(c, address.Hex())
	if err != nil {
		customErr := errors.New("failed to initiate session")
		e.Logger.Error(fmt.Errorf("%s: %w", customErr.Error(), err))
		return c.JSON(http.StatusInternalServerError, wrapError(customErr))
	}

	return c.Redirect(http.StatusMovedPermanently, redirectURI)
}

func decryptJWE(jweRaw string) ([]byte, error) {
	jwe, err := jose.ParseEncrypted(string(jweRaw))
	if err != nil {
		return nil, err
	}

	return jwe.Decrypt(privateKey)
}

func verifySignatureAndGetAddress(message string, signature string) (address common.Address, err error) {
	var sig []byte
	sig, err = hexutil.Decode(signature)
	if err != nil {
		return
	}

	msg := accounts.TextHash([]byte(message))
	if sig[crypto.RecoveryIDOffset] == 27 || sig[crypto.RecoveryIDOffset] == 28 {
		sig[crypto.RecoveryIDOffset] -= 27 // Transform yellow paper V from 27/28 to 0/1
	}

	var pubKey *ecdsa.PublicKey
	pubKey, err = crypto.SigToPub(msg, sig)
	if err != nil {
		return
	}

	address = crypto.PubkeyToAddress(*pubKey)
	return
}

func initiateSession(c echo.Context, address string) (err error) {
	var sess *sessions.Session
	sess, err = session.Get("WALLET_SESSION", c)
	if err != nil {
		return
	}

	sess.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   3600 * 1,
		HttpOnly: true,
		Domain:   targetDomain,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	}
	sess.ID = uuid.NewString()
	sess.Values["WALLET_ADDRESS"] = address
	err = sess.Save(c.Request(), c.Response())
	if err != nil {
		return
	}

	cookie := new(http.Cookie)
	cookie.Name = "WALLET_SESSION_ID"
	cookie.Value = sess.ID
	cookie.Expires = time.Now().Add(1 * time.Hour)
	cookie.Path = "/"
	cookie.Domain = targetDomain
	cookie.HttpOnly = false
	cookie.Secure = true
	cookie.SameSite = http.SameSiteDefaultMode
	c.SetCookie(cookie)

	return
}
