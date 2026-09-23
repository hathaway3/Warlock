import { useEffect, useRef, useState } from 'react';

export function useServerStream<T = any>(url: string | null, onMessage?: (event: string, data: T) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.onerror = (err) => {
      setIsConnected(false);
      setError(err);
    };

    const handleEvent = (eventName: string) => (e: MessageEvent) => {
      if (onMessage) {
        try {
          const parsed = JSON.parse(e.data);
          onMessage(eventName, parsed);
        } catch {
          onMessage(eventName, e.data as any);
        }
      }
    };

    es.addEventListener('stdout', handleEvent('stdout'));
    es.addEventListener('stderr', handleEvent('stderr'));
    es.addEventListener('metrics', handleEvent('metrics'));
    es.addEventListener('done', handleEvent('done'));
    es.onmessage = handleEvent('message');

    return () => {
      es.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [url]);

  return { isConnected, error };
}
