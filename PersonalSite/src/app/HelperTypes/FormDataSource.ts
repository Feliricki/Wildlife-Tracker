import { CollectionViewer, DataSource } from "@angular/cdk/collections";
import { FormControl } from "@angular/forms";
import { StudyService } from "../studies/study.service";
import { BehaviorSubject, Observable, catchError, finalize, forkJoin, map, of, tap } from "rxjs";
import { IndividualJsonDTO } from "../studies/JsonResults/IndividualJsonDTO";
import { WritableSignal, signal } from "@angular/core";
import { TagJsonDTO } from "../studies/JsonResults/TagJsonDTO";

type SourceState = "loading" | "initial" | "error" | "loaded";

export class FormDataSource implements DataSource<FormControl<[boolean, string]>> {

  // TODO: Use a subject tp keep track of the latest changes
  // and then use a loadAnimals method to update to the latest
  // observable and ubsubcribe from the previous one.

  // INFO: If I change the FormControl type then I'll have to change the validators and the original eventForm formGroup.
  // Sorting is possible, but is best done on the backend.

  // TODO: Use forkjoin to receiving the inputs for individuals and tagged animals in unison.

  public dataState: WritableSignal<SourceState> = signal("initial");

  // INFO: These observable map from the local identifier to the object itself.
  private currentAnimals = signal(new Map<string, IndividualJsonDTO>());
  private currentTaggedAnimals = signal(new Map<string, TagJsonDTO>());

  private sourceSubject$ = new BehaviorSubject<FormControl<[boolean, string]>[]>([]);


  constructor(private studyService: StudyService) {
    return;
  }

  connect(collectionViewer: CollectionViewer): Observable<FormControl<[boolean, string]>[]> {
    console.log(collectionViewer);
    return this.sourceSubject$.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    console.log(collectionViewer);
    this.sourceSubject$.complete();
    return;
  }

  // INFO: The inputs require the study's which is aleady present in the event component.
  // And the sort order.
  // 1) First. the observables are combined and fetched in sequence
  // 2) Then the signal containing the current individuals and the tagged animals are updated with their values from the http response.
  // 3) Finally the loading state is updated and the form is sent to the behavior subject to update the final source.
  getAnimalData(studyId: bigint, sortOrder: "asc" | "desc" = "asc"): void {

    this.dataState.set("loading");
    const individuals = this.studyService.jsonRequest("individual", studyId, sortOrder);
    const taggedAnimals = this.studyService.jsonRequest("tag", studyId, sortOrder);

    const combined = forkJoin(individuals, taggedAnimals) as Observable<[IndividualJsonDTO[], TagJsonDTO[]]>;
    combined.pipe(

      tap(tuple => {
        const newAnimals = new Map<string, IndividualJsonDTO>();
        const newTagged = new Map<string, TagJsonDTO>();

        tuple[0].forEach((individual) => {
          newAnimals.set(individual.LocalIdentifier, individual);
        });

        tuple[1].forEach((individual) => {
          newTagged.set(individual.LocalIdentifier, individual);
        });
        this.currentAnimals.set(newAnimals);
        this.currentTaggedAnimals.set(newTagged);
      }),

      catchError(err => {
        console.error(err);
        return of([[], []]) as Observable<[IndividualJsonDTO[], TagJsonDTO[]]>;
      }),
      map(tuple => {
        return tuple[0].map(individual => {
          return new FormControl([false, individual.LocalIdentifier], { nonNullable: true }) as FormControl<[boolean, string]>;
        })
      }),

      finalize(() => this.dataState.set("loaded"))

    ).subscribe({
      next: form => this.sourceSubject$.next(form)
    });
  }

  get TableState(): SourceState {
    return this.dataState();
  }

  get TableSize(): number {
    return this.currentAnimals().size;
  }

  get allIndividuals(): Map<string, IndividualJsonDTO> {
    return this.currentAnimals();
  }

  get allTaggedIndividuals(): Map<string, TagJsonDTO> {
    return this.currentTaggedAnimals();
  }
}
