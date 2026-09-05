import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  clientId?: string;
  jobId?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return requestContext.getStore() ?? {};
}
