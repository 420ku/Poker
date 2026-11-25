jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
