import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CareerPath } from '../entities/career-path.entity';

@Injectable()
export class CareerPathService {
  constructor(
    @InjectRepository(CareerPath)
    private readonly careerPathRepository: Repository<CareerPath>,
  ) {}

  async findAll(): Promise<CareerPath[]> {
    return this.careerPathRepository.find();
  }
}
