export class Client {
  constructor(
    public readonly clientId: number | undefined,
    public fullName: string,
    public email: string,
    public phone: string,
    public readonly registrationDate: Date
  ) {}
}