import { fitWithin, MAX_SIDE } from './image';

describe('fitWithin (요구 13.5)', () => {
  it('긴 변을 1280px로 줄이고 비율을 지킨다', () => {
    expect(fitWithin(4000, 3000, MAX_SIDE)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, MAX_SIDE)).toEqual({ width: 960, height: 1280 });
  });
  it('작은 사진은 그대로', () => {
    expect(fitWithin(800, 600, MAX_SIDE)).toEqual({ width: 800, height: 600 });
  });
});
