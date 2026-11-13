import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

interface PickupSettingsDto {
  id: string;
  warehouseId: string;
  ticketPrefix: string;
  nextDailySequence: number;
  businessTimeZone: string;
  queuePolicy: 'FIFO' | 'PRIORITY_OVERRIDE';
  axDataAreaId: string;
  partialOrderPolicy: 'BLOCK_TICKET' | 'ALLOW_REMOVAL_BY_SUPERVISOR';
  currentSequenceDate?: string | null;
  arrivalCutoffTime?: string | null;
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    TagModule,
    TranslatePipe
  ],
  templateUrl: './admin-settings.component.html'
})
export class AdminSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly messageService = inject(MessageService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly settings = signal<PickupSettingsDto[]>([]);
  readonly editingWarehouse = signal<string | null>(null);
  editVisible = false;

  readonly queuePolicies = ['FIFO', 'PRIORITY_OVERRIDE'];
  readonly partialPolicies = ['BLOCK_TICKET', 'ALLOW_REMOVAL_BY_SUPERVISOR'];

  readonly form = this.fb.nonNullable.group({
    axDataAreaId: ['DAT', [Validators.required]],
    ticketPrefix: ['A-', [Validators.required]],
    businessTimeZone: ['UTC', [Validators.required]],
    queuePolicy: ['FIFO', [Validators.required]],
    partialOrderPolicy: ['BLOCK_TICKET', [Validators.required]],
    arrivalCutoffTime: ['17:00:00']
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.api.get<PickupSettingsDto[]>('/settings').subscribe({
      next: (list: PickupSettingsDto[]) => {
        this.settings.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openEdit(item: PickupSettingsDto): void {
    this.editingWarehouse.set(item.warehouseId);
    this.form.patchValue({
      axDataAreaId: item.axDataAreaId,
      ticketPrefix: item.ticketPrefix,
      businessTimeZone: item.businessTimeZone,
      queuePolicy: item.queuePolicy,
      partialOrderPolicy: item.partialOrderPolicy,
      arrivalCutoffTime: item.arrivalCutoffTime ?? '17:00:00'
    });
    this.editVisible = true;
  }

  save(): void {
    const warehouseId = this.editingWarehouse();
    if (!warehouseId || this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const val = this.form.getRawValue();
    this.api
      .put<PickupSettingsDto>(`/settings/${encodeURIComponent(warehouseId)}`, {
        ...val,
        arrivalCutoffTime: val.arrivalCutoffTime?.trim() || null
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editVisible = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Settings Saved',
            detail: `Updated configuration for ${warehouseId}.`
          });
          this.loadSettings();
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Save Failed',
            detail: 'Could not update settings.'
          });
        }
      });
  }
}
