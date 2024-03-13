import mapboxgl, { IControl } from "mapbox-gl";

export class LayerControl implements IControl {
  _container?: HTMLElement;
  _map?: mapboxgl.Map;

  onAdd(map: mapboxgl.Map): HTMLElement {
    this._container = document.createElement('div');
    this._map = map;

    this._container.className = "mapboxgl-ctrl";
    this._container.innerHTML = `
      <button>
        <svg focusable="false" viewBox="0 0 24 24" aria-hidden="true" style="font-size: 20px;">
          <title>Test Button</title>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path>
        </svg>
      </button>
    `
    // this._container.textContent = "Layers";
    return this._container;
  }

  onRemove(): void {
    if (!this._container) return;
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}

export class TestController implements IControl {
  _container?: HTMLElement;
  _map?: mapboxgl.Map;
  onAdd(map: mapboxgl.Map): HTMLElement {
    this._container = document.createElement('div');
    this._map = map;

    this._container.className = "mapboxgl-ctrl";
    //TODO:Figure out how to change the location and the stlyling of the buttons.
    this._container.innerHTML = `
      <button>Test Button</button>
    `;
    // this._container.innerHTML = `
    //   <button>
    //     <svg focusable="false" viewBox="0 0 24 24" aria-hidden="true" style="font-size: 20px;">
    //       <title>Test Button</title>
    //       <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"></path>
    //     </svg>
    //   </button>
    // `;
    return this._container;
  }

  onRemove(): void {
    if (!this._container) return;

    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}
