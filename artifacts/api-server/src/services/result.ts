export type ServiceError = { ok: false; error: string; status: number };
export type ServiceOk<T> = { ok: true } & T;
export type ServiceResult<T> = ServiceError | ServiceOk<T>;

export function serviceError(error: string, status: number): ServiceError {
  return { ok: false, error, status };
}

export function serviceOk<T>(data: T): ServiceOk<T> {
  return { ok: true, ...data };
}
