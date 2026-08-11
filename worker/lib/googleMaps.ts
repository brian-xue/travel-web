import type { Place } from "@/lib/api";

export function buildGoogleMapsPlaceUrl(place: Pick<Place, "name" | "latitude" | "longitude">) {
  const query = encodeURIComponent(`${place.name} ${place.latitude},${place.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildGoogleMapsDirectionsUrl(places: Array<Pick<Place, "name" | "latitude" | "longitude">>) {
  if (places.length === 0) {
    return "";
  }

  const waypoints = places.slice(1, -1).map((place) => `${place.latitude},${place.longitude}`).join("|");
  const origin = encodeURIComponent(`${places[0].latitude},${places[0].longitude}`);
  const destination = encodeURIComponent(`${places[places.length - 1].latitude},${places[places.length - 1].longitude}`);
  const waypointParam = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointParam}`;
}
