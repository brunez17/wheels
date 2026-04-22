import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Brands: undefined;
  BrandForm: { brandId?: number; initialName?: string };
  Cars: { brandId: number; brandName: string };
  CarEdit: { brandId: number; brandName: string; carId?: number };
  CloudBackup: undefined;
};

export type BrandsScreenProps = NativeStackScreenProps<RootStackParamList, 'Brands'>;
export type BrandFormScreenProps = NativeStackScreenProps<RootStackParamList, 'BrandForm'>;
export type CarsScreenProps = NativeStackScreenProps<RootStackParamList, 'Cars'>;
export type CarEditScreenProps = NativeStackScreenProps<RootStackParamList, 'CarEdit'>;
export type CloudBackupScreenProps = NativeStackScreenProps<RootStackParamList, 'CloudBackup'>;
