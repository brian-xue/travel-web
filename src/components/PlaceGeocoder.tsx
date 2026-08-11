import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, type GeocodingFeature } from "@/lib/api";

interface PlaceGeocoderProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSelect: (feature: GeocodingFeature) => void;
}

function formatFeatureDetail(feature: GeocodingFeature) {
  return feature.place_type?.join(" · ") || feature.text || "Location result";
}

export function PlaceGeocoder({ value, disabled = false, onChange, onSelect }: PlaceGeocoderProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const [features, setFeatures] = useState<GeocodingFeature[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    const query = value.trim();

    setFeatures([]);
    setActiveIndex(-1);
    setError(null);
    if (query.length < 3) {
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setIsOpen(true);

      void api
        .searchGeocoding(query, controller.signal)
        .then((result) => {
          if (requestId !== requestIdRef.current) return;
          setFeatures(result.features);
          setActiveIndex(-1);
        })
        .catch((requestError: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setFeatures([]);
          setError(requestError instanceof Error ? requestError.message : "Place search failed");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setIsLoading(false);
        });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  function chooseFeature(feature: GeocodingFeature) {
    onSelect(feature);
    abortRef.current?.abort();
    setFeatures([]);
    setError(null);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || features.length === 0) {
      if (event.key === "Escape") setIsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % features.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + features.length) % features.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseFeature(features[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  const listVisible = isOpen && (isLoading || Boolean(error) || features.length > 0 || value.trim().length >= 3);

  return (
    <div className="geocoder-field" ref={wrapperRef}>
      <input
        aria-activedescendant={activeIndex >= 0 ? `geocoding-option-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls="place-geocoding-list"
        aria-expanded={listVisible}
        aria-label="Place Name"
        aria-haspopup="listbox"
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (value.trim().length >= 3 && (features.length > 0 || isLoading || error)) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        type="text"
        value={value}
      />
      {listVisible ? (
        <div className="geocoder-results" id="place-geocoding-list" role="listbox">
          {isLoading ? <p className="muted geocoder-status">Searching places...</p> : null}
          {!isLoading && error ? <p className="error-text geocoder-status">{error}</p> : null}
          {!isLoading && !error && features.length === 0 ? <p className="muted geocoder-status">No places found.</p> : null}
          {!isLoading
            ? features.map((feature, index) => (
                <button
                  aria-selected={index === activeIndex}
                  className="geocoder-option"
                  id={`geocoding-option-${index}`}
                  key={feature.id}
                  onClick={() => chooseFeature(feature)}
                  role="option"
                  type="button"
                >
                  <strong>{feature.place_name}</strong>
                  <span>{formatFeatureDetail(feature)}</span>
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
