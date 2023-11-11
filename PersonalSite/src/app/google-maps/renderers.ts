import { Marker, Renderer, Cluster, ClusterStats } from '@googlemaps/markerclusterer';

// function ({ count, position }, stats: Stats ): google.maps.Marker {
//   // use d3-interpolateRgb to interpolate between red and blue
//   const color = this.palette(count / stats.clusters.markers.max);
//   // create svg url with fill color
//   const svg = window.btoa(`
//   <svg fill="${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
//     <circle cx="120" cy="120" opacity=".8" r="70" />
//   </svg>`);
//   // create marker using svg icon
//   return new google.maps.Marker({
//     position,
//     icon: {
//       url: `data:image/svg+xml;base64,${svg}`,
//       scaledSize: new google.maps.Size(75, 75),
//     },
//     label: {
//       text: String(count),
//       color: "rgba(255,255,255,0.9)",
//       fontSize: "12px",
//     },
//     // adjust zIndex to be above other markers
//     zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
//   });
//     }
//

// export const renderer1 = function (pos: google.maps.LatLng, markers: Marker[]): Renderer {
//   const renderFunction = (cluster: Cluster, stats: ClusterStats, map: google.maps.Map) => {
//     return new google.maps.Marker({
//       position: pos,
//       label: String(markers.length),
//       map: map
//     });
//   };
//   const renderer : Renderer = {render: renderFunction};
//   return renderer;
// }

export class Renderer1 implements Renderer {

  public render({count, position }: Cluster, stats: ClusterStats, map: google.maps.Map): Marker {
    return new google.maps.Marker({
      position: position, label: String(count), map: map
    });
  }
}

// export const renderer1: Renderer = {};
