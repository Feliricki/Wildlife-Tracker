import { Injectable } from '@angular/core';
import { EventRequest } from '../studies/EventRequest';
import * as signalR from '@microsoft/signalr';
import { LineStringFeature, LineStringPropertiesV2 } from './GeoJsonTypes';

@Injectable({
  providedIn: 'root'
})
export class SignalrClientService {

  connection: signalR.HubConnection;
  subscription?: signalR.IStreamResult<object>;

  constructor() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl("https://localhost/44043/" + "api/MoveBank-Hub", { withCredentials: false })
      .withStatefulReconnect()
      .build();
  }

  // This function needs to be tested with varying number of results and number of events.
  public getStreamResult(request: EventRequest): signalR.IStreamResult<LineStringFeature<LineStringPropertiesV2>> {
    return this.connection.stream<LineStringFeature<LineStringPropertiesV2>>("StreamEvents", JSON.stringify(request));
  }
}
