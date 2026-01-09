import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistryCredential } from '../entities/registry-credential.entity';
import { RegistryEncryptionHelper } from './registry-encryption.helper';
import { ConfigService } from '@nestjs/config';

export interface CreateRegistryCredentialInput {
  label: string;
  registryUrl: string;
  username: string;
  passwordOrToken: string;
  createdByUserId: string;
}

@Injectable()
export class RegistryService {
  constructor(
    @InjectRepository(RegistryCredential)
    private readonly registryRepo: Repository<RegistryCredential>,
    private readonly configService: ConfigService,
  ) {}

  async createCredential(input: CreateRegistryCredentialInput): Promise<RegistryCredential> {
    if (!input.label || !input.registryUrl) {
      throw new BadRequestException('Label and registryUrl are required');
    }

    const key = this.getEncryptionKey();
    const usernameEnc = RegistryEncryptionHelper.encrypt(input.username, key);
    const passwordEnc = RegistryEncryptionHelper.encrypt(input.passwordOrToken, key);

    const credential = this.registryRepo.create({
      label: input.label,
      registryUrl: input.registryUrl,
      usernameEnc,
      passwordOrTokenEnc: passwordEnc,
      createdByUserId: input.createdByUserId,
      isActive: true,
    });

    return this.registryRepo.save(credential);
  }

  async listSafe(): Promise<Array<Pick<RegistryCredential, 'id' | 'label' | 'registryUrl' | 'createdAt' | 'isActive'>>> {
    const creds = await this.registryRepo.find({ select: ['id', 'label', 'registryUrl', 'createdAt', 'isActive'] });
    return creds;
  }

  async getDecryptedCredential(id: string): Promise<{ registryUrl: string; username: string; passwordOrToken: string }> {
    const cred = await this.registryRepo.findOne({ where: { id } });
    if (!cred) throw new NotFoundException('Registry credential not found');

    const key = this.getEncryptionKey();
    return {
      registryUrl: cred.registryUrl,
      username: RegistryEncryptionHelper.decrypt(cred.usernameEnc, key),
      passwordOrToken: RegistryEncryptionHelper.decrypt(cred.passwordOrTokenEnc, key),
    };
  }

  getEncryptionKey(): string {
    const key = this.configService.get<string>('REGISTRY_ENCRYPTION_KEY');
    const buf = key ? Buffer.from(key, 'hex') : null;
    if (!buf || buf.length !== 32) {
      throw new Error('REGISTRY_ENCRYPTION_KEY must be a 32-byte hex string');
    }
    return key as string;
  }

  async testCredential(cred: RegistryCredential): Promise<boolean> {
    // Placeholder: attempt decrypt to ensure key works; real registry ping could be added here.
    try {
      const key = this.getEncryptionKey();
      RegistryEncryptionHelper.decrypt(cred.usernameEnc, key);
      RegistryEncryptionHelper.decrypt(cred.passwordOrTokenEnc, key);
      await this.registryRepo.update(cred.id, { status: 'ok', lastTestedAt: new Date() as any });
      return true;
    } catch (e) {
      await this.registryRepo.update(cred.id, { status: 'invalid', lastTestedAt: new Date() as any });
      throw new BadRequestException('Credential test failed');
    }
  }
}
