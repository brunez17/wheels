export type Brand = {
  id: number;
  name: string;
  vehicleCount: number;
};

export type CarListItem = {
  id: number;
  brandId: number;
  name: string;
  series: string;
  year: number;
  quantity: number;
  primaryColor: string;
  secondaryColor: string | null;
  thumbUri: string | null;
  /** Torneos ganados (copas). */
  tournamentWins: number;
};

export type TournamentCar = CarListItem & {
  brandName: string;
};

export type CarDetail = {
  id: number;
  brandId: number;
  name: string;
  series: string;
  year: number;
  quantity: number;
  primaryColor: string;
  secondaryColor: string | null;
};

export type CarImageRow = {
  id: number;
  carId: number;
  localUri: string;
  sortOrder: number;
};
