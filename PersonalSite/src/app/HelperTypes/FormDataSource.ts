import { CollectionViewer, DataSource, SelectionModel } from "@angular/cdk/collections";
import { FormArray, FormControl } from "@angular/forms";
import { StudyService } from "../studies/study.service";
import { BehaviorSubject, Observable, catchError, finalize, forkJoin, map, of, tap } from "rxjs";
import { IndividualJsonDTO } from "../studies/JsonResults/IndividualJsonDTO";
import { Signal, WritableSignal, computed, signal } from "@angular/core";
import { TagJsonDTO } from "../studies/JsonResults/TagJsonDTO";

export type SourceState = "loading" | "initial" | "error" | "loaded";
export type FormType = FormControl<[boolean, string]>;

export class FormDataSource implements DataSource<FormControl<boolean>> {

  // TODO: Use a subject tp keep track of the latest changes
  // and then use a loadAnimals method to update to the latest
  // observable and ubsubcribe from the previous one.

  public dataState: WritableSignal<SourceState> = signal("initial");

  private formArray: WritableSignal<FormArray<FormControl<boolean>>>;
  private currentSource: WritableSignal<TagJsonDTO[]> = signal([]);

  private currentAnimals = signal(new Map<string, IndividualJsonDTO>());
  private currentTaggedAnimals = signal(new Map<string, TagJsonDTO>());

  private sourceSubject$: BehaviorSubject<FormArray<FormControl<boolean>>>;
  private selectionModel = new SelectionModel<number>(true, []);

  private hasValue: WritableSignal<boolean> = signal(false);

  constructor(
    private readonly studyService: StudyService,
    readonly formArrayInput: FormArray<FormControl<boolean>>) {
    this.formArray = signal(formArrayInput);
    this.sourceSubject$ = new BehaviorSubject(this.formArray());
    return;
  }

  connect(collectionViewer: CollectionViewer): Observable<FormControl<boolean>[]> {
    console.log(collectionViewer);
    return this.sourceSubject$.asObservable().pipe(
      map(formArray => {
        console.log("Transforming FormArray into array of controls.");
        return formArray.controls;
      })
    );
  }

  disconnect(collectionViewer: CollectionViewer): void {
    console.log(collectionViewer);
    this.sourceSubject$.complete();
  }

  // INFO: The inputs require the study's which is aleady present in the event component.
  // 1) First. the observables are combined and fetched in sequence
  // 2) Then the signal containing the current individuals and the tagged animals are updated with their values from the http response.
  // 3) Finally the loading state is updated and the form is sent to the behavior subject to update the final source.
  getAnimalData(studyId: bigint, sortOrder: "asc" | "desc" = "asc"): void {
    console.log("Getting animal data in formDataSource");
    this.dataState.set("loading");
    this.formArray().clear();
    this.selectionModel.clear();
    this.currentSource.set([]);

    this.hasValue.set(false);
    this.sourceSubject$.next(this.formArray());

    const individuals = this.studyService.jsonRequest("individual", studyId, sortOrder);
    const taggedAnimals = this.studyService.jsonRequest("tag", studyId, sortOrder);

    const combined = forkJoin([individuals, taggedAnimals]) as Observable<[IndividualJsonDTO[], TagJsonDTO[]]>;
    combined.pipe(
      map(tuple => {
        // INFO: This is necessary since some studies will avoiding listing the same animal twice
        // resulting in the individuals having no local identifier (or viceversa).
        const filtered1 = tuple[0].filter(val => val.LocalIdentifier.length > 0);
        const filtered2 = tuple[1].filter(val => val.LocalIdentifier.length > 0);

        return [filtered1, filtered2] as [IndividualJsonDTO[], TagJsonDTO[]];
      }),

      tap(tuple => {

        console.log(`Tapping into new source with id = ${studyId}`);
        const newAnimals = new Map<string, IndividualJsonDTO>();
        const newTagged = new Map<string, TagJsonDTO>();

        // this.currentIndividuals.set(tuple[0]);
        this.currentSource.set(tuple[1]);

        tuple[0].forEach((individual) => {
          newAnimals.set(individual.LocalIdentifier, individual);
        });

        tuple[1].forEach((individual) => {
          newTagged.set(individual.LocalIdentifier, individual);
        });

        this.currentAnimals.set(newAnimals);
        this.currentTaggedAnimals.set(newTagged);
        console.log(this.currentAnimals());
        console.log(this.currentTaggedAnimals());
      }),

      catchError(err => {
        console.error(err);
        this.dataState.set("error");
        return of([[], []]) as Observable<[IndividualJsonDTO[], TagJsonDTO[]]>;
      }),
      map(tuple => {
        // return tuple[0].map(() => {
        //   return new FormControl<boolean>(false, { nonNullable: true });
        // });
        return tuple[1].map(() => {
          return new FormControl<boolean>(false, { nonNullable: true });
        });
      }),

      finalize(() => this.dataState.set("loaded"))

    ).subscribe({
      next: forms => {
        forms.forEach(form => this.formArray().push(form));
        this.formArray.set(this.formArray());
        this.sourceSubject$.next(this.formArray());
      },
      error: err => console.error(err)
    });
  }

  toggleAllRows() {

    if (this.IsAllSelected()) {

      this.selectionModel.clear();

      const prevVal = this.formArray().value;
      this.formArray().setValue(prevVal.map(() => false));
      this.formArray.set(this.formArray());

      this.hasValue.set(this.selectionModel.hasValue());
      return;
    }

    for (let i = 0; i < this.TableSize(); i++) {
      this.selectionModel.select(i);
      const curForm = this.formArray().controls[i];
      // this.setFormValue(curForm, this.selectonModel.isSelected(i));
      this.setFormValue(curForm, this.selectionModel.isSelected(i));
    }
    this.hasValue.set(this.selectionModel.hasValue());
    this.formArray.set(this.formArray());
  }

  get IsAllSelected(): Signal<boolean> {
    return computed(() => this.FormArray().controls.length === this.selectionModel.selected.length);
  }

  toggleRow(index: number): void {
    if (this.dataState() !== "loaded") {
      return;
    }
    this.selectionModel.toggle(index);
    this.hasValue.set(this.selectionModel.hasValue());
  }

  toggleFormHelper(form: FormControl<boolean>) {
    const prevVal = form.value;
    form.setValue(!prevVal);
  }

  setFormValue(form: FormControl<boolean>, newVal: boolean) {
    form.setValue(newVal);
  }

  isSelected(index: number): Signal<boolean> {
    return computed(() => {
      if (index < 0 || index >= this.TableSize()) {
        console.error(`index ${index} was out of bounds.`);
        return false;
      }
      return this.formArray().controls[index].value;
    });
  }

  isToggled(): boolean {
    return this.selectionModel.hasValue();
  }

  isTagged(localIdentifier: string): Signal<boolean> {
    return computed(() => this.currentTaggedAnimals().has(localIdentifier));
  }

  groupIndividuals(): Signal<[IndividualJsonDTO[], TagJsonDTO[]]> {
    return computed(() => [[], []]);
  }

  get FormArray(): Signal<FormArray<FormControl<boolean>>> {
    return computed(() => this.formArray());
  }

  get HasValue(): Signal<boolean> {
    return computed(() => this.hasValue());
  }

  get TableState(): Signal<SourceState> {
    return this.dataState;
  }

  get TableSize(): Signal<number> {
    return computed(() => this.formArray().controls.length);
  }

  get allIndividuals(): Signal<Map<string, IndividualJsonDTO>> {
    return computed(() => this.currentAnimals());
  }

  getIndividual(index: number): Signal<TagJsonDTO | null> {
    return computed(() => {
      if (index < 0 || index >= this.currentSource().length) {
        // console.log(this.currentIndividuals());
        console.error("Out of bounds error.");
        return null;
      }
      return this.currentSource()[index]
    })
  }

  get allTaggedIndividuals(): Signal<Map<string, TagJsonDTO>> {
    return computed(() => this.currentTaggedAnimals());
  }
}
