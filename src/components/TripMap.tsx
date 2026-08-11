import { useEffect, useRef } from "react";
import type { MapData } from "@/lib/api";

export function TripMap({ data }: { data: MapData }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data.maptilerStyleUrl) {
      return;
    }

    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (disposed || !containerRef.current || !data.maptilerStyleUrl) {
        return;
      }

      const map = new maplibre.Map({
        container: containerRef.current,
        style: data.maptilerStyleUrl,
        center: data.places[0] ? [data.places[0].longitude, data.places[0].latitude] : [-110, 40],
        zoom: data.places[0] ? 6 : 3,
      });

      map.on("load", () => {
        const features = data.routes.map((item) => {
          const parsed = JSON.parse(item.route.geojson) as { type: string; geometry?: unknown; properties?: unknown };
          return parsed.type === "Feature"
            ? parsed
            : {
                type: "Feature",
                properties: {
                  name: item.route.name,
                },
                geometry: parsed,
              };
        });

        if (features.length > 0) {
          map.addSource("trip-routes", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features,
            },
          });
          map.addLayer({
            id: "trip-routes-line",
            type: "line",
            source: "trip-routes",
            paint: {
              "line-color": "#0f766e",
              "line-width": 4,
              "line-opacity": 0.85,
            },
          });
        }

        for (const place of data.places) {
          const marker = new maplibre.Marker({ color: "#115e59" })
            .setLngLat([place.longitude, place.latitude])
            .setPopup(
              new maplibre.Popup({ offset: 24 }).setHTML(
                `<strong>${place.name}</strong><p>${place.placeType.replaceAll("_", " ")}</p>`,
              ),
            )
            .addTo(map);
          cleanup = ((previous) => () => {
            previous();
            marker.remove();
          })(cleanup);
        }
      });

      cleanup = ((previous) => () => {
        previous();
        map.remove();
      })(cleanup);
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [data]);

  return <div className="map-surface" ref={containerRef} />;
}
