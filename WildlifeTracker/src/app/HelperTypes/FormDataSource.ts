import { CollectionViewer, DataSource, SelectionModel } from "@angular/cdk/collections";
import { FormArray, FormControl } from "@angular/forms";
import { StudyService } from "../studies/study.service";
import { BehaviorSubject, Observable, catchError, concat, finalize, map, of, tap, toArray } from "rxjs";
import { IndividualJsonDTO } from "../studies/JsonResults/IndividualJsonDTO";
import { Signal, WritableSignal, computed, signal } from "@angular/core";
import { TagJsonDTO } from "../studies/JsonResults/TagJsonDTO";

export type SourceState = "loading" | "initial" | "error" | "loaded";
export type FormType = FormControl<[boolean, string]>;

export class FormDataSource implements DataSource<FormControl<boolean>> {

  public dataState: WritableSignal<SourceState> = signal("initial");
  public dataState$: BehaviorSubject<SourceState> = new BehaviorSubject<SourceState>("initial");

  private formArray: WritableSignal<FormArray<FormControl<boolean>>>;
  private currentSource: WritableSignal<Array<IndividualJsonDTO | TagJsonDTO>> = signal([]);

  private currentAnimals = signal(new Map<string, IndividualJsonDTO>());
  private currentTaggedAnimals = signal(new Map<string, TagJsonDTO>());

  // This is the subject that is used to update the form array.
  private sourceSubject$: BehaviorSubject<FormArray<FormControl<boolean>>>;
  private selectionModel = new SelectionModel<number>(true, []);

  // Dedicated signal for tracking selection state - this is reactive!
  private selectedIndices = signal(new Set<number>());

  private isPartiallySelected = computed(() => {
    const totalCount = this.formArray().controls.length;
    const selectedCount = this.selectedIndices().size;
    return totalCount > 0 && selectedCount > 0 && selectedCount < totalCount;
  });

  private isAllSelected = computed(() => {
    const totalCount = this.formArray().controls.length;
    const selectedCount = this.selectedIndices().size;
    return totalCount > 0 && selectedCount === totalCount;
  });

  constructor(
    private readonly studyService: StudyService,
    readonly formArrayInput: FormArray<FormControl<boolean>>) {
    this.formArray = signal(formArrayInput);
    this.sourceSubject$ = new BehaviorSubject(this.formArray());
    return;
  }

  // eslint-disable-next-line
  connect(collectionViewer: CollectionViewer): Observable<FormControl<boolean>[]> {
    return this.sourceSubject$.asObservable().pipe(
      map(formArray => {
        return formArray.controls;
      })
    );
  }

  // eslint-disable-next-line
  disconnect(collectionViewer: CollectionViewer): void {
    // TODO:Consider if this observable should be closed so that it can be resused.
    // A solution could be to store a reference to the observable in the event
    // component and resuse the observable in different instances of the same table.
  }

  //  The inputs require the study's which is aleady present in the event component.
  // 1) First. the observables are combined and fetched in sequence
  // 2) Then the signal containing the current individuals and the tagged animals are updated with their values from the http response.
  // 3) Finally the loading state is updated and the form is sent to the behavior subject to update the final source.
  getAnimalData(studyId: bigint, sortOrder: "asc" | "desc" = "asc"): void {
    this.dataState.set("loading");
    this.dataState$.next("loading");

    // Clear the form array and the selection model for the new data
    this.formArray().clear();
    this.selectionModel.clear();
    this.selectedIndices.set(new Set<number>());
    this.sourceSubject$.next(this.formArray());

    const individuals = this.studyService.jsonRequest("individual", studyId, sortOrder);
    const taggedAnimals = this.studyService.jsonRequest("tag", studyId, sortOrder);
    const combined = concat(individuals, taggedAnimals);

    combined.pipe(
      toArray(),
      map(results => {
        const individuals = results[0] as IndividualJsonDTO[];
        const taggedAnimals = results[1] as TagJsonDTO[];

        const filteredIndividuals = individuals.filter(val => val.LocalIdentifier && val.LocalIdentifier.length > 0);
        const filteredTaggedAnimals = taggedAnimals.filter(val => val.LocalIdentifier && val.LocalIdentifier.length > 0);

        return [filteredIndividuals, filteredTaggedAnimals] as [IndividualJsonDTO[], TagJsonDTO[]];
      }),
      tap(([individuals, taggedAnimals]) => {
        const newAnimals = new Map<string, IndividualJsonDTO>();
        const newTagged = new Map<string, TagJsonDTO>();

        individuals.forEach(individual => newAnimals.set(individual.LocalIdentifier, individual));
        taggedAnimals.forEach(individual => newTagged.set(individual.LocalIdentifier, individual));

        this.currentAnimals.set(newAnimals);
        this.currentTaggedAnimals.set(newTagged);
      }),
      catchError((err) => {
        console.error(err);
        this.dataState.set("error");
        this.dataState$.next("error");
        return of([[], []] as [IndividualJsonDTO[], TagJsonDTO[]]);
      }),
      map(([individuals, taggedAnimals]) => {
        this.currentSource.set([...individuals, ...taggedAnimals]);
        const formControls = this.currentSource().map(() => new FormControl<boolean>({ value: false, disabled: true }, { nonNullable: true }));
        return formControls;
      }),
      finalize(() => {
        this.dataState.set("loaded");
        this.dataState$.next("loaded");
        this.formArray().controls.forEach(control => control.enable());
      })
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
    if (this.isAllSelected()) {
      // Deselect all
      this.selectionModel.clear();
      this.selectedIndices.set(new Set<number>());

      for (let i = 0; i < this.TableSize(); i++) {
        const control = this.formArray().controls[i];
        if (control) {
          control.setValue(false);
        }
      }
    } else {
      // Select all
      const allIndices = new Set<number>();
      for (let i = 0; i < this.TableSize(); i++) {
        this.selectionModel.select(i);
        allIndices.add(i);
        const control = this.formArray().controls[i];
        if (control) {
          control.setValue(true);
        }
      }
      this.selectedIndices.set(allIndices);
    }
  }

  get IsAllSelected(): Signal<boolean> {
    return this.isAllSelected;
  }

  toggleRow(index: number): void {
    if (this.dataState() !== "loaded") {
      return;
    }

    this.selectionModel.toggle(index);
    const isSelected = this.selectionModel.isSelected(index);

    // Update the form control value
    const control = this.formArray().controls[index];
    if (control) {
      control.setValue(isSelected);
    }

    // Update the selectedIndices signal
    this.selectedIndices.update(current => {
      const newSet = new Set(current);
      if (isSelected) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      return newSet;
    });
  }

  toggleFormHelper(form: FormControl<boolean>) {
    const prevVal = form.value;
    this.setFormValue(form, !prevVal);
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
      return this.selectedIndices().has(index);
    });
  }

  isToggled(): boolean {
    return this.selectedIndices().size > 0;
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

  get IsPartiallySelected(): Signal<boolean> {
    return this.isPartiallySelected;
  }

  get TableState(): Signal<SourceState> {
    return this.dataState;
  }

  get TableSize(): Signal<number> {
    return computed(() => this.formArray().controls.length);
  }

  get DataStateAsObservable() {
    return this.dataState$.asObservable();
  }

  get allIndividuals(): Signal<Map<string, IndividualJsonDTO>> {
    return computed(() => this.currentAnimals());
  }

  get taggedAndSelectedIndividuals(): Signal<string[]> {
    return computed(() => {
      const individuals: string[] = [];
      const selectedSet = this.selectedIndices();
      const sources = this.currentSource();

      selectedSet.forEach(index => {
        if (index >= 0 && index < sources.length) {
          individuals.push(sources[index].LocalIdentifier);
        }
      });

      return individuals;
    })
  }

  getIndividual(index: number): Signal<TagJsonDTO | IndividualJsonDTO | null> {
    return computed(() => {
      if (index < 0 || index >= this.currentSource().length) {
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
