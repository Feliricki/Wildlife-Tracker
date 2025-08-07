import { Injectable } from '@angular/core';
import { luma } from '@luma.gl/core';
import { webgl2Adapter } from '@luma.gl/webgl';

@Injectable({
  providedIn: 'root'
})
export class LumaDeviceService {
  private device: any;

  async initializeDevice() {
    if (!this.device) {
      this.device = await luma.createDevice({
        adapters: [webgl2Adapter],
        createCanvasContext: {
          width: 1,
          height: 1
        }
      });
    }
  }
}
