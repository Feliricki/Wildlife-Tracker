import { HttpClientModule, HttpClientJsonpModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { NavBarComponent } from './nav-bar/nav-bar.component';

import { AngularMaterialModule } from './angular-material.module';

// import { GoogleMapsModule } from '@angular/google-maps';
import { AuthModule } from './auth/auth.module';
import { LoginComponent } from './auth/login.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SideNavComponent } from './side-nav/side-nav.component';
import { MapComponent } from './map/map.component';
import { StudiesComponent } from './studies/studies.component';
import { TimestampPipe } from './pipes/timestamp.pipe';
import { DefaultPipe } from './pipes/default.pipe';
import { TruncatePipe } from './pipes/truncate.pipe';
import { SimpleSearchComponent } from './simple-search/simple-search.component';
import { AuthInterceptor } from './auth/auth.interceptor';
import { GetTaxaPipe } from './pipes/get-taxa.pipe';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    NavBarComponent,
    LoginComponent,
    SideNavComponent,
    MapComponent,
    StudiesComponent,
    TimestampPipe,
    DefaultPipe,
    TruncatePipe,
    SimpleSearchComponent,
    GetTaxaPipe,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    HttpClientJsonpModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    AngularMaterialModule,
    AuthModule,
    BrowserAnimationsModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
