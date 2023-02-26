import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type Wallet = {
  address: string;
};

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: `${process.env.REACT_APP_AUTH_API_HOST || "http://localhost:1323"}`,
  }),
  endpoints: (/*{ query }*/) => ({
  }),
})

export const {} = authApi;