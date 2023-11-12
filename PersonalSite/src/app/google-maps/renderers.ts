import { Marker, Renderer, Cluster, ClusterStats, MarkerUtils } from '@googlemaps/markerclusterer';
// import { interpolateRgb } from "d3-interpolate";

export class Renderer1 implements Renderer {

  public render(
    { count, position }: Cluster,
    stats: ClusterStats,
    map: google.maps.Map
  ): Marker {
    // change color if this cluster has more markers than the mean cluster
    // const color =
    //   count > Math.max(10, stats.clusters.markers.mean) ? "#ff0000" : "#0000ff";

    // create svg literal with fill color
    // const svg = `<svg fill="${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="50" height="50">
    //   <circle cx="120" cy="120" opacity=".6" r="70" />
    //   <circle cx="120" cy="120" opacity=".3" r="90" />
    //   <circle cx="120" cy="120" opacity=".2" r="110" />
    //   <text x="50%" y="50%" style="fill:#fff" text-anchor="middle" font-size="50" dominant-baseline="middle" font-family="roboto,arial,sans-serif">${count}</text>
    //   </svg>`;

    const title = `Cluster of ${count} markers`;
    // adjust zIndex to be above other markers
    const zIndex: number = Number(google.maps.Marker.MAX_ZINDEX) + count;
    const para = document.createElement("div");
    para.style.fontSize = "15px";
    para.innerText = `${count}`;

    if (MarkerUtils.isAdvancedMarkerAvailable(map)) {
      const pinGlyph = new google.maps.marker.PinElement({
        glyph: para,
        glyphColor: 'white',
        scale: 1.0,
      });

      const clusterOptions: google.maps.marker.AdvancedMarkerElementOptions = {
        map,
        position,
        zIndex,
        title,
        content: pinGlyph.element
        // content: svgEl,
      };
      return new google.maps.marker.AdvancedMarkerElement(clusterOptions);
    }

    const clusterOptions: google.maps.MarkerOptions = {
      position,
      zIndex,
      title,
    };
    return new google.maps.Marker(clusterOptions);
  }
}
// export class Renderer2 implements Renderer {
//   public render({ count, position }: Cluster, stats: ClusterStats, map: google.maps.Map): Marker {
//     // palette: interpolateRgb("red", "blue"),
//     // use d3-interpolateRgb to interpolate between red and blue
//     // const color = this.palette(count / stats.clusters.markers.max);
//     // create svg url with fill colo
//     const color = count > Math.max(10, stats.clusters.markers.mean) ? "#ff0000" : "#0000ff";
//     const svg = window.btoa(`
//   <svg fill="${color}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
//     <circle cx="120" cy="120" opacity=".8" r="70" />
//   </svg>`);
//     const title = `Cluster of ${count} markers`;
//     // adjust zIndex to be above other markers
//     const zIndex: number = Number(google.maps.Marker.MAX_ZINDEX) + count;
//     if (MarkerUtils.isAdvancedMarkerAvailable(map)) {
//       // create cluster SVG element
//       const parser = new DOMParser();
//       const svgEl = parser.parseFromString(
//         svg,
//         "image/svg+xml"
//       ).documentElement;
//       svgEl.setAttribute("transform", "translate(0 25)");
//
//       const clusterOptions: google.maps.marker.AdvancedMarkerElementOptions = {
//         map,
//         position,
//         zIndex,
//         title,
//         content: svgEl,
//       };
//       return new google.maps.marker.AdvancedMarkerElement(clusterOptions);
//     }
//
//     const clusterOptions: google.maps.MarkerOptions = {
//       position,
//       zIndex,
//       title,
//       icon: {
//         url: `data:image/svg+xml;base64,${btoa(svg)}`,
//         anchor: new google.maps.Point(25, 25),
//       },
//     };
//     return new google.maps.Marker(clusterOptions);
//     // return new google.maps.Marker({
//     //   position,
//     //   icon: {
//     //     url: `data:image/svg+xml;base64,${svg}`,
//     //     scaledSize: new google.maps.Size(75, 75),
//     //   },
//     //   label: {
//     //     text: String(count),
//     //     color: "rgba(255,255,255,0.9)",
//     //     fontSize: "12px",
//     //   },
//     //   // adjust zIndex to be above other markers
//     // });
//   }
// }

// export class Renderer3 implements Renderer {
//   public render({ count, position }: Cluster, stats: ClusterStats, map: google.maps.Map): Marker {
//
//     if (MarkerUtils.isAdvancedMarkerAvailable(map)) {
//       // create cluster SVG element
//       // const title = `Cluster of ${count} markers`;
//
//       const clusterOptions: google.maps.marker.AdvancedMarkerElementOptions = {
//         map: map,
//         position: position,
//         zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
//         title: String(count),
//       };
//       return new google.maps.marker.AdvancedMarkerElement(clusterOptions);
//     } else {
//       return new google.maps.Marker({
//         label: { text: String(count), color: "white", fontSize: "10px" },
//         position,
//         // adjust zIndex to be above other markers
//         zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
//       });
//     }
//   }
// }
