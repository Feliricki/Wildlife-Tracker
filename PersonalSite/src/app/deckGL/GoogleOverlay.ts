import { GoogleMapsOverlay as DeckOverlay } from '@deck.gl/google-maps/typed';
import { LineLayer } from '@deck.gl/layers/typed';
import {EventJsonDTO} from "../studies/JsonResults/EventJsonDTO";


interface Point {
  timestamp: bigint;
  date: Date;
  lat: number;
  lng: number;
  // Optional fields
  taxonId?: string;
}
interface Path {
  inbound: number;
  outbound: number;
  from: Point[];
  to: Point[];
}

export class GoogleMapOverlay {
  map: google.maps.Map;
  deckOverlay: DeckOverlay;
  constructor(map: google.maps.Map, deckOverlay: DeckOverlay){
    this.map = map;
    this.deckOverlay = deckOverlay;
  }

  preprocessEvents(events: EventJsonDTO): Path[] {
    const allEvents = events.IndividualEvents;
    const paths: Path[] = [];

    for (const individualEvents of allEvents){

      const path: Path = {
        inbound: individualEvents.locations.length,
        outbound: individualEvents.locations.length,
        from: [],
        to: [],
      };

      for (const locationEvent of individualEvents.locations){
        const point : Point = {
          timestamp: locationEvent.timestamp,
          date: new Date(locationEvent.timestamp.toString()),
          lat: locationEvent.locationLat,
          lng: locationEvent.locationLong,
        };
        path.from.push(point);
      }
    }

    return paths;
  }
  // TODO: Ideally, we want clear the map when a new source is added and replace the source with the new information.
  // An implicit assumption is that the events are sorted by date (using their timestamp).
  // TODO: The backend should preprocess this data into the following format.
  // The datetime object can be generated on the frontend and used as a tooltip.
  // Split up the responsibility into the separate methods and one updateAll method.
  addLineLayer(events: EventJsonDTO) {
    const lineLayer = new LineLayer({
      id: 'event-path',
      data: events,
      pickable: true,
      getWidth: 30,

    });

    return lineLayer;
  }
}
