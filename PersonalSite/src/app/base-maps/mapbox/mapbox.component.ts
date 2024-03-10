import { ChangeDetectionStrategy, Component, Output, EventEmitter, Input, OnInit, WritableSignal, signal, OnChanges, SimpleChanges } from '@angular/core';
import { StudyDTO } from 'src/app/studies/study';
import { AsyncPipe } from '@angular/common';
import { LayerTypes } from 'src/app/deckGL/GoogleOverlay';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StudyService } from 'src/app/studies/study.service';
import mapboxgl, { GeoJSONSource, MapboxGeoJSONFeature } from 'mapbox-gl';
import { InfoWindowComponent } from '../google maps/info-window/info-window.component';
import { NgElement, WithProperties } from '@angular/elements';
import { Subscription } from 'rxjs';

type MapState =
  'initial' |
  'loading' |
  'loaded' |
  'error' |
  'rate-limited';

type EventState =
  "initial" |
  "loaded" |
  "loading" |
  "time out" |
  "error";


@Component({
  selector: 'app-mapbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe, MatProgressSpinnerModule
  ],
  templateUrl: './mapbox.component.html',
  styleUrl: './mapbox.component.css'
})
export class MapboxComponent implements OnInit, OnChanges {

  // TODO:Start working on this component
  // Start by first setting up the base map with default options
  // and then work on setting up markers and then marker clustering.
  // then check if the info window styling can be reused and if not
  // just redo the component.

  // NOTE:Restricted mapbox key
  mapboxToken = "pk.eyJ1IjoiZmVsaXJpY2tpIiwiYSI6ImNsdGRkYjZnZjAyOXcycXA3anN0ZHZqbW8ifQ.XHxBIr35WPQYtd9BshOTdA";
  mainSubscription?: Subscription;

  currentCollection?: GeoJSON.FeatureCollection<GeoJSON.Point, StudyDTO>;
  studies?: Map<bigint, StudyDTO>;

  currentMapState: WritableSignal<MapState> = signal('initial');
  currentEventsState: WritableSignal<EventState> = signal('initial');
  currentMarker?: bigint;

  movingToPoint: WritableSignal<boolean> = signal(false);
  // INFO:Overlay Controls
  // TODO:Right now I'm working on getting the pan to marker/point feature to work.
  @Input() selectedLayer: LayerTypes = LayerTypes.ArcLayer;
  @Input() focusedPoint?: bigint;

  // INFO:This section is for data that is sent to the tracker component.
  @Output() studiesEmitter = new EventEmitter<Map<bigint, StudyDTO>>();
  @Output() mapStateEmitter = new EventEmitter<boolean>();
  @Output() studyEmitter = new EventEmitter<StudyDTO>();

  map?: mapboxgl.Map;

  constructor(private studyService: StudyService) {
  }

  ngOnInit(): void {
    this.initializeMap();
  }

  initializeMap(): void {
    if (this.map) return;
    try {
      if (!mapboxgl.supported()) {
        this.currentMapState.set('error');
        alert('Your browser does not support Mapbox GL.');
        return;
      }

      console.log(`Using Mapbox GL JS v${mapboxgl.version}`);
      this.currentMapState.set('loading');

      mapboxgl.accessToken = this.mapboxToken;
      this.map = new mapboxgl.Map({
        container: 'map',
        center: [0, 0],
        zoom: 5,
      });

      // TODO:Add some controls for resetting the position back to the default.
      // And add some controls for changing the current layer.
      this.map
        .addControl(new mapboxgl.NavigationControl())
        .addControl(new mapboxgl.ScaleControl())
        .addControl(new mapboxgl.GeolocateControl())
        .addControl(new mapboxgl.FullscreenControl());

      this.map.on('load', () => {
        if (!this.map) {
          this.currentMapState.set("error");
          return;
        }
        this.currentMapState.set('loaded');
        this.emitMapState();

        const studies$ = this.studyService.getAllStudiesGeoJSON<StudyDTO>();
        this.mainSubscription = studies$.subscribe({
          next: collection => {
            if (!this.map) {
              this.currentMapState.set('error');
              return;
            }

            this.currentCollection = collection;
            this.studies = new Map<bigint, StudyDTO>();
            // The purpose of this set is to prevent points from overlapping completely.
            const coordinates = new Set<string>();
            for (const feature of this.currentCollection.features.values()) {
              if (feature.properties.mainLocationLon == undefined || feature.properties.mainLocationLat === undefined) {
                console.log('Skipping the following feature.');
                console.log(feature);
                continue;
              }

              // BUG:The map will pan to the incorrect point if they overlap.
              let key = `${feature.properties.mainLocationLon.toString()},${feature.properties.mainLocationLat.toString()}`;
              while (coordinates.has(key)) {
                feature.properties.mainLocationLon += 0.002;
                feature.geometry.coordinates[0] += 0.002; // This changes the longitude
                key = `${feature.properties.mainLocationLon.toString()},${feature.properties.mainLocationLat.toString()}`;
              }
              coordinates.add(key);
              this.studies.set(feature.properties.id, feature.properties);
            }
            // console.log(`Coordinates has ${coordinates.size} elements and collection has ${collection.features.length} features.`);
            // console.log(this.studies);

            this.map.addSource('studies', {
              type: "geojson",
              data: collection,
              cluster: true,
              clusterMinPoints: 2, // Default is 2
              clusterMaxZoom: 10,
              clusterRadius: 50,
            });

            this.map.addLayer({
              id: "clusters",
              type: "circle",
              source: "studies",
              filter: ['has', 'point_count'],
              paint: {
                // TODO: Change the threshold values.
                // Use step expressions (https://docs.mapbox.com/style-spec/reference/expressions/#step)
                // with three steps to implement three types of circles:
                //   * Blue, 20px circles when point count is less than 50
                //   * Yellow, 30px circles when point count is between 50 and 100
                //   * Pink, 40px circles when point count is greater than or equal to 100
                'circle-color': [
                  'step',
                  ['get', 'point_count'],
                  '#51bbd6',
                  50,
                  '#f1f075',
                  100,
                  '#f28cb1'
                ],
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  20,
                  50,
                  30,
                  100,
                  40
                ]
              }
            });

            this.map.addLayer({
              id: "cluster-count",
              type: "symbol",
              source: "studies",
              filter: ['has', "point_count"],
              layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12,
              }
            });

            this.map.addLayer({
              id: "unclustered-point",
              type: "circle",
              source: "studies",
              filter: ["!", ["has", "point_count"]],
              paint: {
                'circle-color': '#11b4da',
                'circle-radius': 8,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff' // white outline
              },
            });

            //INFO:This callback function inspect a cluster on click.
            this.map.on('click', 'clusters', (e) => {
              console.log(e);
              if (!this.map) return;

              const features = this.map.queryRenderedFeatures(e.point, {
                layers: ['clusters'],
              }) as Array<MapboxGeoJSONFeature & GeoJSON.Feature<GeoJSON.Point>>;

              const clusterId = features[0].properties!['cluster_id'] as number;
              const source = this.map.getSource('studies') as GeoJSONSource;
              // This moves the camera to the location clicked and zooms in enough to expand the clustered points.
              source.getClusterExpansionZoom(clusterId,
                (err, zoom) => {
                  if (err || !this.map) return;

                  this.map.easeTo({
                    center: features[0].geometry.coordinates as [number, number],
                    zoom: zoom
                  });
                }
              );
            });

            this.map.on('click', 'unclustered-point', (e) => {
              console.log(e);
              if (!this.map) return;

              const features = e.features as Array<MapboxGeoJSONFeature & GeoJSON.Feature<GeoJSON.Point, StudyDTO>>;
              const coordinates = features[0].geometry.coordinates as [number, number];

              const study = features[0].properties;

              // while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
              //   coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
              // }

              new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setDOMContent(this.createPopupContent(study))
                .addTo(this.map);
            });

            this.map.on('moveend', () => {
              if (this.movingToPoint() === false || !this.map) {
                return;
              }

              this.map.fire('click', this.map.getCenter());
              // const source = this.map.getSource('studies') as GeoJSONSource;
              console.log(`clicked on location ${this.map.getCenter()}`);
              this.movingToPoint.set(false);
            })

            this.map.on('mouseenter', 'clusters', () => {
              if (!this.map) return;
              this.map.getCanvas().style.cursor = 'pointer';
            });

            this.map.on('mouseleave', 'clusters', () => {
              if (!this.map) return;
              this.map.getCanvas().style.cursor = '';
            });

            this.map.on('mouseenter', 'unclustered-point', () => {
              if (!this.map) return;
              this.map.getCanvas().style.cursor = 'pointer';
            });

            this.map.on('mouseleave', 'unclustered-point', () => {
              if (!this.map) return;
              this.map.getCanvas().style.cursor = '';
            });

            // this.map.on('click', (e) => {
            //   console.log(`Clicked on location: ${JSON.stringify(e.lngLat)}`);
            // });
          },
          error: err => {
            console.error(err);
            this.currentMapState.set('error');
          }
        });
      });
    }
    catch (error) {
      console.error(error);
      this.currentMapState.set('error');
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      const currentValue = changes[propertyName].currentValue;
      if (currentValue === undefined) {
        continue;
      }

      switch (propertyName) {
        case "focusedPoint":
          console.log(`focusedPoint = ${currentValue as bigint}`);
          this.focusedPoint = currentValue as bigint;
          this.panToPoint(currentValue as bigint);
          break;

        default:
          return;
      }
    }
  }

  panToPoint(studyId: bigint): void {
    if (!this.map || !this.studies) return;
    // NOTE:In this method I would want the coordinates of the study's location.
    const study = this.studies.get(studyId);
    if (!study) return;

    this.movingToPoint.set(true);
    this.map.easeTo({
      center: [study.mainLocationLon ?? 0, study.mainLocationLat ?? 0],
      zoom: 14
    });
  }

  addMarker(latitude: number, longitude: number, popUp?: mapboxgl.Popup): mapboxgl.Marker {
    let marker = new mapboxgl.Marker()
      .setLngLat([longitude, latitude]);

    if (popUp !== undefined) {
      marker = marker
        .setPopup(popUp);
    }

    return marker;
  }

  createPopupContent(studyDTO: StudyDTO): Node {
    const infoWindowEl = document.createElement('info-window-el') as NgElement & WithProperties<InfoWindowComponent>;

    infoWindowEl.currentStudy = studyDTO;
    infoWindowEl.eventRequest = this.studyEmitter;

    return infoWindowEl;
  }

  createPopUp(studyDTO: StudyDTO): mapboxgl.Popup {
    const popUp = new mapboxgl.Popup();
    const content = this.createPopupContent(studyDTO);
    popUp.setDOMContent(content);
    return popUp;
  }

  emitMapState(): void {
    this.mapStateEmitter.emit(true);
  }

  emitStudy(study: StudyDTO): void {
    this.studyEmitter.emit(study);
  }
}
