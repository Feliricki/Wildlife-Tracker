import { ChangeDetectionStrategy, Component, Output, EventEmitter, Input, OnInit, WritableSignal, signal, OnChanges, SimpleChanges, Injector } from '@angular/core';
import { StudyDTO } from 'src/app/studies/study';
import { AsyncPipe } from '@angular/common';
import { DeckOverlayController, LayerTypes, StreamStatus } from 'src/app/deckGL/DeckOverlayController';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StudyService } from 'src/app/studies/study.service';
import mapboxgl, { GeoJSONSource, MapboxGeoJSONFeature } from 'mapbox-gl';
import { InfoWindowComponent } from '../google maps/info-window/info-window.component';
import { NgElement, WithProperties } from '@angular/elements';
import { Observable, Subscription, distinctUntilChanged, skip } from 'rxjs';
import { EventRequest } from 'src/app/studies/EventRequest';
import { toObservable } from '@angular/core/rxjs-interop';
import { EventMetadata } from 'src/app/events/EventsMetadata';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from '../snackbar.component';
import { LayerControl, setSourceLayers } from './layer-controls';
import { ControlChange } from 'src/app/events/events.component';

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
  @Input() selectedLayer: LayerTypes = LayerTypes.ArcLayer;
  @Input() focusedPoint?: bigint;
  @Input() eventRequest?: EventRequest;
  @Input() pointsVisible?: boolean;
  @Input() deckOverlayControls?: ControlChange;

  // INFO:This section is for data that is sent to the tracker component.
  @Output() studiesEmitter = new EventEmitter<Map<bigint, StudyDTO>>();
  @Output() mapStateEmitter = new EventEmitter<boolean>();
  @Output() chunkInfoEmitter = new EventEmitter<EventMetadata>();
  @Output() studyEmitter = new EventEmitter<StudyDTO>();
  @Output() streamStatusEmitter = new EventEmitter<StreamStatus>();

  map?: mapboxgl.Map;
  layerControl?: LayerControl;

  deckOverlay?: DeckOverlayController;
  streamStatus$?: Observable<StreamStatus>;
  streamStatusSubscription?: Subscription;
  chunkLoadSubscription?: Subscription;

  constructor(
    private studyService: StudyService,
    private snackbar: MatSnackBar,
    private injector: Injector) {
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
        style: "mapbox://styles/feliricki/cltqf12yx00p301p5dq5hcmiv",
        center: [0, 0],
        zoom: 5,
      });

      // TODO:Add some controls for resetting the position back to the default.
      // Add a custom controller for changing the style of the basemap.
      this.map
        .addControl(new mapboxgl.NavigationControl())
        .addControl(new mapboxgl.ScaleControl())
        .addControl(new mapboxgl.GeolocateControl())
        .addControl(new mapboxgl.FullscreenControl())

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

            this.layerControl = new LayerControl(collection);
            this.map = this.map.addControl(this.layerControl, "bottom-left");

            this.currentCollection = collection;
            this.studies = new Map<bigint, StudyDTO>();
            //INFO:The purpose of this set is to prevent points from overlapping completely.
            const coordinates = new Set<string>();
            for (const feature of this.currentCollection.features.values()) {
              if (feature.properties.mainLocationLon == undefined || feature.properties.mainLocationLat === undefined) {
                continue;
              }

              let key = `${feature.properties.mainLocationLon.toString()},${feature.properties.mainLocationLat.toString()}`;
              while (coordinates.has(key)) {
                feature.properties.mainLocationLon += 0.002;
                feature.geometry.coordinates[0] += 0.002; // This changes the longitude
                key = `${feature.properties.mainLocationLon.toString()},${feature.properties.mainLocationLat.toString()}`;
              }
              coordinates.add(key);
              this.studies.set(feature.properties.id, feature.properties);
            }

            this.emitStudies(this.studies);
            // NOTE:This function is used in the controller component and here hence the import
            setSourceLayers(this.map, collection, "studies");
            this.initializeDeckOverlay(this.map);

            this.map.on('click', 'clusters', (e) => {
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

            // NOTE:Globe view kicks in at zoom level 6.
            // this.map.on('click', (e) => {
            //   // console.log(e);
            //   console.log(`Current zoom: ${JSON.stringify(this.map?.getZoom())}`)
            // });

            this.map.on('click', 'unclustered-point', (e) => {
              console.log(e);
              if (!this.map) return;

              const features = e.features as Array<MapboxGeoJSONFeature & GeoJSON.Feature<GeoJSON.Point, StudyDTO>>;
              const coordinates = features[0].geometry.coordinates as [number, number];

              const study = features[0].properties;

              // TODO:Include a button to change this style dynamically.
              // while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
              //   coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
              // }

              new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setDOMContent(this.createPopupContent(study))
                .addTo(this.map);

              //NOTE:The GeoJSON sources need to be set again if the style ever changes.
              // this.map.setStyle("mapbox://styles/feliricki/cltqf12yx00p301p5dq5hcmiv");
            });

            this.map.on('moveend', () => {
              if (this.movingToPoint() === false || !this.map) {
                return;
              }

              this.map.fire('click', this.map.getCenter());
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

        case "eventRequest":
          this.eventRequest = currentValue as EventRequest;
          this.handleEventRequest(currentValue as EventRequest);
          break;

        case "pointsVisible":
          this.pointsVisible = currentValue as boolean;
          console.log(`Setting point visibility to ${this.pointsVisible}`);
          this.layerControl?.setStudiesVisibility(this.pointsVisible);
          this.togglePointsVisibility(this.pointsVisible);
          break;

        // INFO:Deck Overlay Controls
        case "selectedLayer":
          this.selectedLayer = currentValue as LayerTypes;
          this.deckOverlay?.changeActiveLayer(this.selectedLayer);
          break;

        case "deckOverlayControls":
          this.deckOverlayControls = currentValue as ControlChange;
          this.deckOverlay?.setLayerAttributes(this.deckOverlayControls);
          console.log(`Updated overlay controls with`);
          console.log(this.deckOverlayControls);
          break;

        default:
          return;
      }
    }
  }

  initializeDeckOverlay(map: mapboxgl.Map) {
    console.log(`Initializing the deck overlay controls for mapbox with layer ${this.selectedLayer}`);
    this.deckOverlay = new DeckOverlayController(map, this.selectedLayer);
    this.streamStatus$ = toObservable(this.deckOverlay.StreamStatus, {
      injector: this.injector
    });

    const onChunkload$ = toObservable(this.deckOverlay.currentMetaData, {
      injector: this.injector
    });

    onChunkload$.pipe(skip(1))
      .subscribe({
        next: chunk => this.emitChunkData(chunk),
        error: err => console.error(err),
      });

    this.streamStatusSubscription = this.streamStatus$.pipe(
      skip(1),
      distinctUntilChanged(),
    )
      .subscribe({
        next: (status: StreamStatus) => {
          const numIndividuals = this.deckOverlay?.CurrentIndividuals().size ?? 0;
          switch (status) {
            case "standby":
              this.emitStreamStatus("standby");
              if (numIndividuals === 0) {
                this.openSnackBar("No Events Found.");
                break;
              }
              this.openSnackBar(`Events found for ${numIndividuals} animal(s).`);
              break;

            case "error":
              this.emitStreamStatus("error");
              // TODO:Snackbar needs to be opened
              break;
            case "streaming":
              this.emitStreamStatus("streaming");
              break;
          }
        },
        error: err => console.error(err)
      },
      )
  }

  togglePointsVisibility(visible: boolean): void {
    if (!this.map || !this.currentCollection) return;
    let source = this.map.getSource("studies") as GeoJSONSource;
    if (!source){
      setSourceLayers(
        this.map,
        this.currentCollection,
        'studies');
      source = this.map.getSource('studies') as GeoJSONSource;
    }

    if (visible) {
      source.setData(this.currentCollection);
    } else {
      source.setData({
        type: "FeatureCollection",
        features: [],
      } as GeoJSON.FeatureCollection<GeoJSON.Point, object>);
    }
  }

  handleEventRequest(request: EventRequest) {
    if (!this.map) {
      console.error("Map not set before receiving event request");
      return;
    }
    if (!this.deckOverlay) {
      console.error(`DeckOverlay not set before receiving event request.`);
      return;
    }
    this.deckOverlay.loadData(request, { type: "mapbox", map: this.map });
  }

  openSnackBar(message: string, timeLimit: number = 2) {
    this.snackbar.openFromComponent(SnackbarComponent, { duration: timeLimit * 1000, data: message });
  }

  panToPoint(studyId: bigint): void {
    if (!this.map || !this.studies) return;
    // NOTE:In this method I would want the coordinates of the study's location.
    const study = this.studies.get(studyId);
    if (!study) return;

    console.log(`Panning to point ${JSON.stringify(study)}`);
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

  emitStudies(studies: Map<bigint, StudyDTO>): void {
    this.studiesEmitter.emit(studies);
  }

  emitChunkData(chunkInfo: EventMetadata): void {
    this.chunkInfoEmitter.emit(chunkInfo);
  }

  emitStreamStatus(streamStatus: StreamStatus): void {
    this.streamStatusEmitter.emit(streamStatus);
  }
}

export class MapboxSnackbarComponent {

}
