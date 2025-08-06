export interface LoginResult {
    success: boolean;
    message: string;
    roles: string[];
    token?: string;
}
