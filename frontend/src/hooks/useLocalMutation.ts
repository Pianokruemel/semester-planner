import { useState } from "react";

export function useLocalMutation<TPayload, TResult>(handler: (payload: TPayload) => TResult | Promise<TResult>) {
  const [isPending, setIsPending] = useState(false);

  async function mutateAsync(payload: TPayload): Promise<TResult> {
    setIsPending(true);

    try {
      return await handler(payload);
    } finally {
      setIsPending(false);
    }
  }

  return {
    isPending,
    mutate(payload: TPayload) {
      void mutateAsync(payload);
    },
    mutateAsync
  };
}