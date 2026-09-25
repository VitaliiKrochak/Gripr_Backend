import { NovaPoshtaError, NovaPoshtaService } from './novaposhta.service';

describe('NovaPoshtaService', () => {
  const service = new NovaPoshtaService({
    apiKey: 'np-key',
    baseUrl: 'https://novaposhta.test/',
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('searches cities by name', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        success: true,
        errors: [],
        data: [
          {
            Ref: 'city-1',
            Description: 'Київ',
            SettlementTypeDescription: 'місто',
            AreaDescription: 'Київська',
          },
        ],
      }),
    );

    await expect(service.searchCities('Ки')).resolves.toEqual([
      {
        ref: 'city-1',
        name: 'Київ',
        settlementType: 'місто',
        area: 'Київська',
      },
    ]);
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual({
      apiKey: 'np-key',
      modelName: 'Address',
      calledMethod: 'getCities',
      methodProperties: { FindByString: 'Ки', Limit: '20', Page: '1' },
    });
  });

  it('searches warehouses within a city', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        success: true,
        errors: [],
        data: [
          {
            Ref: 'wh-1',
            Number: '1',
            Description: 'Відділення №1',
            ShortAddress: 'Київ, вул. Хрещатик, 1',
            CategoryOfWarehouse: 'Branch',
          },
        ],
      }),
    );

    await expect(service.searchWarehouses('city-1', '1')).resolves.toEqual([
      {
        ref: 'wh-1',
        number: '1',
        name: 'Відділення №1',
        shortAddress: 'Київ, вул. Хрещатик, 1',
        category: 'Branch',
      },
    ]);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string) as {
      methodProperties: Record<string, string>;
    };
    expect(body.methodProperties).toEqual({
      CityRef: 'city-1',
      FindByString: '1',
      Limit: '50',
      Page: '1',
    });
  });

  it('throws on API errors', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({
        success: false,
        errors: ['API key expired'],
        data: [],
      }),
    );

    await expect(service.searchCities('Київ')).rejects.toThrow(NovaPoshtaError);
  });
});
