export interface ApiErrorPayload {
  code: string;
  message: string;
}

export function jsonSuccess<T>(data: T, init?: ResponseInit) {
  return Response.json(
    {
      ok: true,
      data,
      error: null,
    },
    init,
  );
}

export function jsonError(status: number, error: ApiErrorPayload) {
  return Response.json(
    {
      ok: false,
      data: null,
      error,
    },
    { status },
  );
}
