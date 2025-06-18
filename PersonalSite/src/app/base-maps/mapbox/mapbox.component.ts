import { ChangeDetectionStrategy, Component, OnInit, WritableSignal, signal, Injector, inject, DestroyRef, OnDestroy } from '@angular/core';
import { StudyDTO } from 'src/app/studies/study';
import { AsyncPipe } from '@angular/common';
import { DeckOverlayController, StreamStatus } from 'src/app/deckGL/DeckOverlayController';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StudyService } from 'src/app/studies/study.service';
import mapboxgl, { GeoJSONSource, MapboxGeoJSONFeature } from 'mapbox-gl';
import { InfoWindowComponent } from '../google maps/info-window/info-window.component';
import { NgElement, WithProperties } from '@angular/elements';
import { Subscription, distinctUntilChanged, skip } from 'rxjs';
import { EventRequest } from 'src/app/studies/EventRequest';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from '../snackbar.component';
import { LayerControl, setSourceLayers } from './layer-controls';
import { MatButtonModule } from '@angular/material/button';
import { HintControl } from './hint-control';

// Import the new services
import { UIStateService } from '../../services/ui-state.service';
import { MapStateService } from '../../services/map-state.service';
import { DeckOverlayStateService } from '../../services/deck-overlay-state.service';

type MapState =
    'initial' |
    'loading' |
    'loaded' |
    'error' |
    'rate-limited';

@Component({
    selector: 'app-mapbox',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AsyncPipe, MatProgressSpinnerModule, MatButtonModule,
    ],
    templateUrl: './mapbox.component.html',
    styleUrl: './mapbox.component.css'
})
export class MapboxComponent implements OnInit, OnDestroy {
    // Inject services
    private readonly uiStateService = inject(UIStateService);
    private readonly mapStateService = inject(MapStateService);
    private readonly deckOverlayStateService = inject(DeckOverlayStateService);
    private readonly studyService = inject(StudyService);
    private readonly snackbar = inject(MatSnackBar);
    private readonly injector = inject(Injector);
    private readonly destroyRef = inject(DestroyRef);

    // NOTE:Restricted mapbox key
    mapboxToken = "pk.eyJ1IjoiZmVsaXJpY2tpIiwiYSI6ImNsdGRkMWppMDA1ODUyanBmNWczZnp1c20ifQ.efFPdWGtuf6qkLsCo9KlqQ";

    currentCollection?: GeoJSON.FeatureCollection<GeoJSON.Point, StudyDTO>;
    studies?: Map<bigint, StudyDTO>;

    currentMapState: WritableSignal<MapState> = signal('initial');
    movingToPoint: WritableSignal<boolean> = signal(false);

    map?: mapboxgl.Map;

    // deck.gl
    layerControl?: LayerControl;
    deckOverlay?: DeckOverlayController;

    // subscriptions
    streamStatusSub?: Subscription;
    eventChunkSub?: Subscription;

    constructor() {
        // Subscribe to focused marker changes from the service
        this.mapStateService.focusedStudyId$
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                distinctUntilChanged()
            )
            .subscribe(studyId => {
                if (studyId) {
                    this.panToPoint(studyId);
                }
            });

        // Subscribe to marker visibility changes
        this.mapStateService.pointsVisible$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(visible => {
                this.layerControl?.setStudiesVisibility(visible);
                this.togglePointsVisibility(visible);
            });

        // Subscribe to layer changes
        this.deckOverlayStateService.currentLayer$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(layer => {
                this.deckOverlay?.changeActiveLayer(layer);
            });

        // Subscribe to control changes
        this.deckOverlayStateService.controlChange$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(change => {
                if (change) {
                    this.deckOverlay?.setLayerAttributes(change);
                }
            })

        // Subscribe to event requests
        this.deckOverlayStateService.eventRequest$
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                distinctUntilChanged()
            )
            .subscribe(request => {
                if (request) {
                    this.handleEventRequest(request);
                }
            })
    }

    ngOnDestroy(): void {
        this.streamStatusSub?.unsubscribe();
        this.eventChunkSub?.unsubscribe();
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
            });

            this.map
                .addControl(new mapboxgl.NavigationControl())
                .addControl(new mapboxgl.ScaleControl())
                .addControl(new mapboxgl.GeolocateControl())
                .addControl(new mapboxgl.FullscreenControl());

            this.map.on('load', () => {
                console.log("loaded mapbox resources");
                if (!this.map) {
                    this.currentMapState.set("error");
                    return;
                }
                this.currentMapState.set('loaded');

                // Use service instead of emitting
                this.uiStateService.setMapLoaded(true);
                this.mapStateService.setMapLoaded(true);

                const studies$ = this.studyService.getAllStudiesGeoJSON<StudyDTO>();
                // takeUntilDestroyed cannot be used in this context
                studies$.pipe().subscribe({
                    next: collection => {
                        if (!this.map) {
                            this.currentMapState.set('error');
                            return;
                        }

                        this.layerControl = new LayerControl(collection);
                        this.map = this.map
                            .addControl(this.layerControl, "bottom-left")
                            .addControl(new HintControl(), "bottom-left");

                        this.currentCollection = collection;
                        this.studies = new Map<bigint, StudyDTO>();

                        const coordinates = new Set<string>();
                        for (const feature of this.currentCollection.features.values()) {
                            if (feature.properties.mainLocationLon == undefined || feature.properties.mainLocationLat === undefined) {
                                continue;
                            }

                            let key = `${feature.properties.mainLocationLon.toString()},${feature.properties.mainLocationLat.toString()}`;
                            while (coordinates.has(key)) {
                                feature.properties.mainLocationLon += 0.002;
                                feature.geometry.coordinates[0] += 0.002;
                                key = `${feature.properties.mainLocationLon.toString()},${feature.properties.mainLocationLat.toString()}`;
                            }
                            coordinates.add(key);
                            this.studies.set(feature.properties.id, feature.properties);
                        }

                        // Use service instead of emitting
                        this.mapStateService.setStudies(this.studies);

                        setSourceLayers(this.map, collection, "studies");
                        this.initializeDeckOverlay(this.map);

                        this.map.on('click', 'clusters', (e) => {
                            if (!this.map) return;

                            const features = this.map.queryRenderedFeatures(e.point, {
                                layers: ['clusters'],
                            }) as Array<MapboxGeoJSONFeature & GeoJSON.Feature<GeoJSON.Point>>;

                            const clusterId = features[0].properties!['cluster_id'] as number;
                            const source = this.map.getSource('studies') as GeoJSONSource;

                            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                                if (err || !this.map) return;
                                this.map.easeTo({
                                    center: features[0].geometry.coordinates as [number, number],
                                    zoom: zoom
                                });
                            });
                        });

                        this.map.on('click', 'unclustered-point', (e) => {
                            if (!this.map) return;

                            const features = e.features as Array<MapboxGeoJSONFeature & GeoJSON.Feature<GeoJSON.Point, StudyDTO>>;
                            const coordinates = features[0].geometry.coordinates as [number, number];
                            const study = features[0].properties;

                            new mapboxgl.Popup()
                                .setLngLat(coordinates)
                                .setDOMContent(this.createPopupContent(study))
                                .addTo(this.map);
                        });

                        this.map.on('moveend', () => {
                            if (this.movingToPoint() === false || !this.map) {
                                return;
                            }
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

    // This method is initialized once on map load
    initializeDeckOverlay(map: mapboxgl.Map) {
        this.deckOverlay = new DeckOverlayController(map, this.deckOverlayStateService.currentLayer());

        const streamStatus$ = toObservable(this.deckOverlay.StreamStatus, {
            injector: this.injector
        });

        const onChunkload$ = toObservable(this.deckOverlay.currentMetaData, {
            injector: this.injector
        });

        this.eventChunkSub = onChunkload$.pipe(
            skip(1),
        ).subscribe({
            next: chunk => this.mapStateService.setEventData(chunk),
            error: err => console.error(err),
        });

        this.streamStatusSub = streamStatus$.pipe(
            skip(1),
            distinctUntilChanged(),
        ).subscribe({
            next: (status: StreamStatus) => {
                const numIndividuals = this.deckOverlay?.CurrentIndividuals().size ?? 0;

                switch (status) {
                    case "standby":
                        this.mapStateService.setStreamStatus("standby");
                        if (numIndividuals === 0) {
                            this.openSnackBar("No Events Found.");
                            break;
                        }
                        this.openSnackBar(`Events found for ${numIndividuals} animal(s).`);
                        break;

                    case "error":
                        this.mapStateService.setStreamStatus("error");
                        this.openSnackBar("Error retrieving events.");
                        break;

                    case "streaming":
                        this.mapStateService.setStreamStatus("streaming");
                        break;
                }
            },
            error: err => console.error(err)
        });
    }

    togglePointsVisibility(visible: boolean): void {
        if (!this.map || !this.currentCollection) return;

        let source = this.map.getSource("studies") as GeoJSONSource;
        if (!source) {
            setSourceLayers(this.map, this.currentCollection, 'studies');
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
        this.snackbar.openFromComponent(SnackbarComponent, {
            duration: timeLimit * 1000,
            data: message
        });
    }

    panToPoint(studyId: bigint): void {
        if (!this.map || !this.studies) return;

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
            marker = marker.setPopup(popUp);
        }

        return marker;
    }

    createPopupContent(studyDTO: StudyDTO): Node {
        const infoWindowEl = document.createElement('info-window-el') as NgElement & WithProperties<InfoWindowComponent>;

        infoWindowEl.currentStudy = studyDTO;
        infoWindowEl.mapStateService = this.mapStateService;

        return infoWindowEl;
    }

    createPopUp(studyDTO: StudyDTO): mapboxgl.Popup {
        const popUp = new mapboxgl.Popup();
        const content = this.createPopupContent(studyDTO);
        popUp.setDOMContent(content);
        return popUp;
    }
}
