import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportButton from '../components/ImportButton';
import saveService from '../services/SaveService';
import communityService from '../services/CommunityService';
import { importData } from '../store/CommunitySlice';
import { setCurrentCategory } from '../store/UISlice';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('react-router', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('../services/SaveService', () => ({
  __esModule: true,
  default: {
    parseImport: jest.fn(),
  },
}));

jest.mock('../services/CommunityService', () => ({
  __esModule: true,
  default: {
    validateImport: jest.fn(),
  },
}));

jest.mock('../store/CommunitySlice', () => ({
  importData: jest.fn(),
}));

jest.mock('../store/UISlice', () => ({
  setCurrentCategory: jest.fn(),
}));

type MockNotificationConstructor = jest.Mock & {
  permission: NotificationPermission;
  requestPermission: jest.Mock;
};

const mockDispatch = jest.fn();
const mockNavigate = jest.fn();

const mockedUseDispatch = useDispatch as jest.Mock;
const mockedUseNavigate = useNavigate as jest.Mock;
const mockParseImport = saveService.parseImport as jest.Mock;
const mockValidateImport = communityService.validateImport as jest.Mock;
const mockImportData = importData as jest.Mock;
const mockSetCurrentCategory = setCurrentCategory as jest.Mock;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const createFile = () =>
  new File([JSON.stringify({ test: true })], 'import.json', {
    type: 'application/json',
  });

const getBaseImportData = () => ({
  communeKey: '08212000',
  communeName: 'Karlsruhe',
  inputs: {
    fieldA: 10,
    fieldB: 'text',
    fieldC: true,
  },
  sources: {
    fieldA: 'backend-source',
    fieldB: '   ',
    fieldC: '',
  },
  individual: {
    fieldA: false,
    fieldB: false,
    fieldC: true,
  },
});

const setNotificationMock = (
  permission: NotificationPermission
): MockNotificationConstructor => {
  const NotificationMock = jest.fn() as unknown as MockNotificationConstructor;
  NotificationMock.permission = permission;
  NotificationMock.requestPermission = jest.fn().mockResolvedValue(permission);

  Object.defineProperty(window, 'Notification', {
    value: NotificationMock,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(global, 'Notification', {
    value: NotificationMock,
    configurable: true,
    writable: true,
  });

  return NotificationMock;
};

const removeNotificationMock = () => {
  delete (window as any).Notification;
  delete (global as any).Notification;
};

const renderComponent = () =>
  render(
    <ImportButton>
      {(triggerImport) => (
        <button onClick={triggerImport}>Import starten</button>
      )}
    </ImportButton>
  );

const getFileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

describe('ImportButton', () => {
  let alertSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseDispatch.mockReturnValue(mockDispatch);
    mockedUseNavigate.mockReturnValue(mockNavigate);

    mockImportData.mockImplementation((payload) => ({
      type: 'community/importData',
      payload,
    }));

    mockSetCurrentCategory.mockImplementation((payload) => ({
      type: 'ui/setCurrentCategory',
      payload,
    }));

    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    setNotificationMock('granted');
  });

  afterEach(() => {
    alertSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('requests notification permission on mount, triggers file input click, and ignores empty selection', () => {
    const NotificationMock = setNotificationMock('default');

    const { container } = renderComponent();
    const input = getFileInput(container);

    const clickSpy = jest.fn();
    input.click = clickSpy;

    expect(NotificationMock.requestPermission).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Import starten'));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { files: [] } });
    expect(mockParseImport).not.toHaveBeenCalled();
  });

  it('imports successfully, validates sourced fields, shows overlay, merges backend updates, and navigates', async () => {
    const NotificationMock = setNotificationMock('granted');
    const data = getBaseImportData();

    mockParseImport.mockResolvedValue(clone(data));

    let resolveValidation!: (value: unknown) => void;
    mockValidateImport.mockReturnValue(
      new Promise((resolve) => {
        resolveValidation = resolve;
      })
    );

    const { container } = renderComponent();
    const input = getFileInput(container);

    Object.defineProperty(input, 'value', {
      value: 'C:\\fakepath\\import.json',
      writable: true,
      configurable: true,
    });

    fireEvent.change(input, { target: { files: [createFile()] } });

    expect(await screen.findByText('Validiere Daten...')).toBeInTheDocument();
    expect(screen.getByText('Bitte warten Sie einen Moment')).toBeInTheDocument();
    expect(input).toBeDisabled();

    expect(mockValidateImport).toHaveBeenCalledWith({
      community_key: '08212000',
      inputs: [
        {
          id: 'fieldA',
          value: 10,
          source: 'backend-source',
        },
      ],
    });

    resolveValidation({
      fieldA: {
        value: 99,
        individual: true,
        source: 'fresh-backend-source',
      },
    });

    await waitFor(() => {
      expect(mockImportData).toHaveBeenCalledWith({
        communeKey: '08212000',
        communeName: 'Karlsruhe',
        inputs: {
          fieldA: 99,
          fieldB: 'text',
          fieldC: true,
        },
        sources: {
          fieldA: 'fresh-backend-source',
          fieldB: '   ',
          fieldC: '',
        },
        individual: {
          fieldA: true,
          fieldB: false,
          fieldC: true,
        },
      });
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'community/importData',
      payload: expect.any(Object),
    });
    expect(mockSetCurrentCategory).toHaveBeenCalledWith('General');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ui/setCurrentCategory',
      payload: 'General',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/input');

    expect(NotificationMock).toHaveBeenCalledWith('Import erfolgreich', {
      body: 'Karlsruhe: 1 Feld(er) wurden aktualisiert',
      icon: '/favicon.ico',
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Import erfolgreich!\n\nKommune: Karlsruhe\n1 Feld(er) wurden mit aktuellen Daten aktualisiert.'
    );

    await waitFor(() => {
      expect(screen.queryByText('Validiere Daten...')).not.toBeInTheDocument();
    });

    expect(input).not.toBeDisabled();
    expect(input.value).toBe('');
  });

  it('imports successfully without backend validation when no sourced fields exist', async () => {
    const NotificationMock = setNotificationMock('granted');
    const data = getBaseImportData();

    data.sources = {
      fieldA: '',
      fieldB: '   ',
      fieldC: '',
    };

    mockParseImport.mockResolvedValue(clone(data));

    const { container } = renderComponent();
    const input = getFileInput(container);

    Object.defineProperty(input, 'value', {
      value: 'C:\\fakepath\\import.json',
      writable: true,
      configurable: true,
    });

    fireEvent.change(input, { target: { files: [createFile()] } });

    await waitFor(() => {
      expect(mockImportData).toHaveBeenCalled();
    });

    expect(mockValidateImport).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/input');

    expect(NotificationMock).toHaveBeenCalledWith('Import erfolgreich', {
      body: 'Karlsruhe: Alle Daten sind aktuell',
      icon: '/favicon.ico',
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Import erfolgreich!\n\nKommune: Karlsruhe\nAlle Daten sind aktuell.'
    );

    expect(input.value).toBe('');
  });

  it('continues import when backend validation fails and falls back to alert when Notification API is unavailable', async () => {
    removeNotificationMock();

    const data = getBaseImportData();
    mockParseImport.mockResolvedValue(clone(data));
    mockValidateImport.mockRejectedValue(new Error('Backend down'));

    const { container } = renderComponent();
    const input = getFileInput(container);

    Object.defineProperty(input, 'value', {
      value: 'C:\\fakepath\\import.json',
      writable: true,
      configurable: true,
    });

    fireEvent.change(input, { target: { files: [createFile()] } });

    await waitFor(() => {
      expect(mockImportData).toHaveBeenCalled();
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Backend validation failed, continuing with import:',
      expect.any(Error)
    );
    expect(mockNavigate).toHaveBeenCalledWith('/input');
    expect(alertSpy).toHaveBeenCalledWith(
      'Import erfolgreich!\n\nKommune: Karlsruhe\nAlle Daten sind aktuell.'
    );
    expect(input.value).toBe('');
  });

  it('shows an error notification when the imported structure is invalid', async () => {
    const NotificationMock = setNotificationMock('granted');

    mockParseImport.mockResolvedValue({
      communeKey: '08212000',
      communeName: 'Karlsruhe',
      inputs: {},
      individual: {},
    });

    const { container } = renderComponent();
    const input = getFileInput(container);

    Object.defineProperty(input, 'value', {
      value: 'C:\\fakepath\\import.json',
      writable: true,
      configurable: true,
    });

    fireEvent.change(input, { target: { files: [createFile()] } });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Import failed:',
        expect.any(Error)
      );
    });

    expect(NotificationMock).toHaveBeenCalledWith('Import fehlgeschlagen', {
      body: 'Ungültiges Dateiformat: Fehlende Pflichtfelder',
      icon: '/favicon.ico',
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Fehler beim Import:\n\nUngültiges Dateiformat: Fehlende Pflichtfelder\n\nBitte überprüfen Sie die Datei und versuchen Sie es erneut.'
    );

    expect(mockImportData).not.toHaveBeenCalled();
    expect(mockSetCurrentCategory).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('shows an error alert for unknown import errors', async () => {
    removeNotificationMock();

    mockParseImport.mockRejectedValue('kaputt');

    const { container } = renderComponent();
    const input = getFileInput(container);

    Object.defineProperty(input, 'value', {
      value: 'C:\\fakepath\\import.json',
      writable: true,
      configurable: true,
    });

    fireEvent.change(input, { target: { files: [createFile()] } });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Import failed:', 'kaputt');
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Fehler beim Import:\n\nUnbekannter Fehler\n\nBitte überprüfen Sie die Datei und versuchen Sie es erneut.'
    );

    expect(mockImportData).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });
});