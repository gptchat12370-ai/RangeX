import { useCallback, useEffect, useState } from "react";
import { solverApi } from "../api/solverApi";
import { Scenario } from "../types";

export function useScenarioDetail(id?: string) {
  const [data, setData] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await solverApi.getScenarioDetail(id);
      setData(detail);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail };
}
