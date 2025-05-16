import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, concatMap } from 'rxjs';
import { environment } from 'src/environments/environment.development';
import { AuthService } from '../auth/auth.service';
import { UpdateStudiesResult } from './models/update-studies';

@Injectable({
    providedIn: 'root'
})
export class AdminService {

    constructor(private httpClient: HttpClient, private authService: AuthService) { }


    // NOTE:Errors should be handle in places where this is used
    //  This request with check for admin permissions before making the final request
    //  otherwise the empty observable is returned
    updateStudies(): Observable<UpdateStudiesResult> {
        return this.authService.hasAdminAuthorization().pipe(
            concatMap(isAdmin => {
                return isAdmin ? this.updateStudiesHelper() : EMPTY;
            })
        );
    }

    private updateStudiesHelper(): Observable<UpdateStudiesResult> {
        const url = environment.baseUrl + "api/seed/UpdateStudies";
        return this.httpClient.post<UpdateStudiesResult>(url, {}).pipe(
        );
    }
}
