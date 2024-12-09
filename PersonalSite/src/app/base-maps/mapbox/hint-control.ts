import mapboxgl, { IControl } from "mapbox-gl";

export class HintControl implements IControl {
  _container?: HTMLButtonElement;
  _map?: mapboxgl.Map;

  onAdd(map: mapboxgl.Map): HTMLElement {
    this._container = document.createElement("button");
    this._map = map;

    // this._container.innerText = "Hold Crtl to rotate";
    this._container.className = "mapboxgl-ctrl";
    this._container.textContent = "Hold Ctrl to rotate";
    this._container.style.color = "black";
    this._container.style.backgroundColor = "white";

    return this._container;
  }

  onRemove(): void {
    this._map = undefined;
  }
}
