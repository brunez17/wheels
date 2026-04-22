import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BrandsScreen } from '../screens/BrandsScreen';
import { BrandFormScreen } from '../screens/BrandFormScreen';
import { CarsScreen } from '../screens/CarsScreen';
import { CarEditScreen } from '../screens/CarEditScreen';
import { CloudBackupScreen } from '../screens/CloudBackupScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f2f4f7',
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#f2f4f7' },
          headerTitleStyle: { fontWeight: '700', color: '#111827' },
        }}
      >
        <Stack.Screen name="Brands" component={BrandsScreen} options={{ title: 'Marcas' }} />
        <Stack.Screen
          name="BrandForm"
          component={BrandFormScreen}
          options={({ route }) => ({
            title: route.params?.brandId != null ? 'Editar marca' : 'Nueva marca',
          })}
        />
        <Stack.Screen
          name="Cars"
          component={CarsScreen}
          options={({ route }) => ({ title: route.params.brandName })}
        />
        <Stack.Screen
          name="CarEdit"
          component={CarEditScreen}
          options={({ route }) => ({
            title: route.params.carId != null ? 'Editar auto' : 'Nuevo auto',
          })}
        />
        <Stack.Screen name="CloudBackup" component={CloudBackupScreen} options={{ title: 'Respaldo' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
