import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { useStaticIndiaPublicHolidayDates } from '../appointments/india-public-holidays';
import { PublicHoliday } from './public-holiday.schema';
import { PublicHolidaysService } from './public-holidays.service';

describe('PublicHolidaysService', () => {
  afterEach(() => {
    useStaticIndiaPublicHolidayDates();
  });

  it('lists static holidays in a date range when the collection is empty', async () => {
    const find = jest.fn().mockReturnValue({
      select: () => ({
        lean: () => ({
          exec: async () => [],
        }),
      }),
    });
    const countDocuments = jest.fn().mockReturnValue({ exec: async () => 0 });

    const module = await Test.createTestingModule({
      providers: [
        PublicHolidaysService,
        {
          provide: getModelToken(PublicHoliday.name),
          useValue: { find, countDocuments },
        },
      ],
    }).compile();

    const service = module.get(PublicHolidaysService);
    const listed = await service.listInRange('IN', '2026-10-01', 10);
    expect(listed.source).toBe('static');
    expect(listed.items.some((row) => row.date === '2026-10-02')).toBe(true);
  });
});
