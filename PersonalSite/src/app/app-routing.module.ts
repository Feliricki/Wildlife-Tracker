import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './auth/login.component';
import { ReferenceComponent} from "./static-pages/references/reference.component";
import {PageNotFoundComponent} from "./page-not-found/page-not-found.component";
// import { SuggestionsComponent } from './static-pages/suggestions/suggestions.component';

const routes: Routes = [  
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'references', component: ReferenceComponent },
  { path: 'login', component: LoginComponent },
  // { path: 'suggestions', component: SuggestionsComponent},
  { path: '**', component: PageNotFoundComponent },
];
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
