import { CollectionViewer, DataSource } from "@angular/cdk/collections";
import { FormControl } from "@angular/forms";
import { StudyService } from "../studies/study.service";
import { BehaviorSubject, Observable, catchError, finalize, map, of } from "rxjs";
import { IndividualJsonDTO } from "../studies/JsonResults/IndividualJsonDTO";
import { WritableSignal, signal } from "@angular/core";
import { TagJsonDTO } from "../studies/JsonResults/TagJsonDTO";


type SourceState = "loading" | "initial" | "error" | "loaded";

export class FormDataSource implements DataSource<FormControl<boolean>> {

  // TODO: Use a subject tp keep track of the latest changes
  // and then use a loadAnimals method to update to the latest
  // observable and ubsubcribe from the previous one.

  // INFO: If I change the FormControl type then I'll have to change the validators and the original eventForm formGroup.
  // Sorting is possible, but is best done on the backend.

  public dataState: WritableSignal<SourceState> = signal("initial");

  private currentAnimals = signal(new Map<bigint, IndividualJsonDTO>());
  private currentTaggedAnimals = signal(new Map<bigint, TagJsonDTO>());

  private sourceSubject$ = new BehaviorSubject<FormControl<boolean>[]>([]);


  constructor(private studyService: StudyService) {
    return;
  }

  connect(collectionViewer: CollectionViewer): Observable<FormControl<boolean>[]> {
    console.log(collectionViewer);
    return this.sourceSubject$.asObservable();
  }

  disconnect(collectionViewer: CollectionViewer): void {
    console.log(collectionViewer);
    this.sourceSubject$.complete();
    return;
  }

  getAnimalData(entityType: "study" | "tag" | "individual", studyId: bigint): void {

    this.dataState.set("loading");
    this.studyService.jsonRequest(entityType, studyId).pipe(
      // map(res => res),
      map(arr => {

        const newMap = new Map<bigint, unknown>();
        arr.forEach((animal) => {
          newMap.set(animal.Id, animal);
        });

        switch (entityType) {
          case "individual":
            this.currentAnimals.set(newMap as Map<bigint, IndividualJsonDTO>);
            break;
          case "tag":
            this.currentTaggedAnimals.set(newMap as Map<bigint, TagJsonDTO>);
            break;
          case "study":
            break;
          default:
            break;
        }

        return arr.map(() => new FormControl<boolean>(false, { nonNullable: true }))
      }),

      catchError(err => {
        console.log(err);

        this.dataState.set("error");
        return of([]);
      }),

      finalize(() => this.dataState.set("loaded")),

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
}
