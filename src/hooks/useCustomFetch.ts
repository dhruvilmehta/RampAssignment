import { useCallback, useContext } from "react"
import { AppContext } from "../utils/context"
import { fakeFetch, RegisteredEndpoints } from "../utils/fetch"
import { useWrappedRequest } from "./useWrappedRequest"

export function useCustomFetch() {
  const { cache } = useContext(AppContext)
  const { loading, wrappedRequest } = useWrappedRequest()

  const fetchWithCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params?: TParams
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        if (params && (params as any).value !== null) {
          cache?.current.forEach((value, key) => {
            let employeeId = "";
            if (key.startsWith("paginatedTransactions")) {
              const parsedValue = JSON.parse(value)
              parsedValue.data.forEach((val: any) => {
                if (val.id === (params as any).transactionId) {
                  val.approved = (params as any).value
                  employeeId = val.employee.id
                }
              })

              cache.current.set(key, JSON.stringify(parsedValue))

              if (employeeId) {
                let employeeTransactions = cache.current.get(`transactionsByEmployee@{"employeeId":"${employeeId}"}`)
                const parsedEmployeeTransactions = JSON.parse(employeeTransactions || "{}")

                parsedEmployeeTransactions.forEach((val: any) => {
                  if (val.id === (params as any).transactionId) {
                    val.approved = (params as any).value
                  }
                });
                cache.current.set(`transactionsByEmployee@{"employeeId":"${employeeId}"}`, JSON.stringify(parsedEmployeeTransactions))
              }
            }
          })
        }
        const cacheKey = getCacheKey(endpoint, params)
        const cacheResponse = cache?.current.get(cacheKey)

        if (cacheResponse) {
          const data = JSON.parse(cacheResponse)
          return data as Promise<TData>
        }

        const result = await fakeFetch<TData>(endpoint, (params as any))
        cache?.current.set(cacheKey, JSON.stringify(result))
        return result
      }),
    [cache, wrappedRequest]
  )

  const fetchWithoutCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params?: TParams
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        const result = await fakeFetch<TData>(endpoint, params)
        return result
      }),
    [wrappedRequest]
  )

  const clearCache = useCallback(() => {
    if (cache?.current === undefined) {
      return
    }

    cache.current = new Map<string, string>()
  }, [cache])

  const clearCacheByEndpoint = useCallback(
    (endpointsToClear: RegisteredEndpoints[]) => {
      if (cache?.current === undefined) {
        return
      }

      const cacheKeys = Array.from(cache.current.keys())

      for (const key of cacheKeys) {
        const clearKey = endpointsToClear.some((endpoint) => key.startsWith(endpoint))

        if (clearKey) {
          cache.current.delete(key)
        }
      }
    },
    [cache]
  )

  return { fetchWithCache, fetchWithoutCache, clearCache, clearCacheByEndpoint, loading }
}

function getCacheKey(endpoint: RegisteredEndpoints, params?: object) {
  return `${endpoint}${params ? `@${JSON.stringify(params)}` : ""}`
}
