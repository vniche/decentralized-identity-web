import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Wallet = {
  address: string;
};

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.REACT_APP_AUTH_API_HOST || "http://localhost:1323"}`,
    credentials: 'include'
  }),
  endpoints: ({ query }) => ({
    me: query<Wallet, void>({
      query: () => `/v1/me`,
    }),
  }),
})

export const {
  useMeQuery
} = authApi;