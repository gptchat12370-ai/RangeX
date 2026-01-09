import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class UsageDaily {
  @PrimaryColumn({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  envHoursMicro: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  envHoursSmall: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  envHoursMedium: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  envHoursLarge: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEstimatedCostRm: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  vcpuCostRm: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  memoryCostRm: number;
}
