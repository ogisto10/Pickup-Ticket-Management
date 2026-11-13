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
    TagModule
  ],
  template: `
    <div class="flex flex-column gap-4">
      <div>
        <h2 class="m-0 text-2xl font-bold text-900">Queue and Application Settings</h2>
        <p class="m-0 text-600 text-sm">
          Configure warehouse ticket numbering, time zone, AX company, and operational policies.
        </p>
      </div>

      <p-card>
        <p-table [value]="settings()" [loading]="loading()" styleClass="p-datatable-sm p-datatable-striped">
          <ng-template pTemplate="header">
            <tr>
              <th>Warehouse</th>
              <th>AX Company</th>
              <th>Ticket Prefix</th>
              <th>Next Sequence</th>
              <th>Time Zone</th>
              <th>Queue Policy</th>
              <th>Partial Order Policy</th>
              <th>Arrival Cutoff</th>
              <th style="width: 7rem">Edit</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-s>
            <tr>
              <td class="font-bold">{{ s.warehouseId }}</td>
              <td>{{ s.axDataAreaId }}</td>
              <td>{{ s.ticketPrefix }}</td>
              <td>{{ s.nextDailySequence }}</td>
              <td>{{ s.businessTimeZone }}</td>
              <td><p-tag [value]="s.queuePolicy" severity="info"></p-tag></td>
              <td><p-tag [value]="s.partialOrderPolicy" severity="warning"></p-tag></td>
              <td>{{ s.arrivalCutoffTime || '—' }}</td>
              <td>
                <p-button
                  label="Edit"
                  icon="pi pi-pencil"
                  size="small"
                  [outlined]="true"
                  (onClick)="openEdit(s)"
                ></p-button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <p-dialog
        [header]="'Edit Settings — ' + (editingWarehouse() || '')"
        [(visible)]="editVisible"
        [modal]="true"
        [style]="{ width: '520px' }"
      >
        <form [formGroup]="form" class="flex flex-column gap-3">
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm">AX Company (DataAreaId)</label>
            <input type="text" pInputText formControlName="axDataAreaId" />
          </div>
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm">Ticket Prefix</label>
            <input type="text" pInputText formControlName="ticketPrefix" />
          </div>
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm">Business Time Zone (IANA / Windows ID)</label>
            <input type="text" pInputText formControlName="businessTimeZone" />
          </div>
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm">Queue Policy</label>
            <p-dropdown
              formControlName="queuePolicy"
              [options]="queuePolicies"
              styleClass="w-full"
            ></p-dropdown>
          </div>
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm">Partial-Order Policy (Blocked Orders)</label>
            <p-dropdown
              formControlName="partialOrderPolicy"
              [options]="partialPolicies"
              styleClass="w-full"
            ></p-dropdown>
          </div>
          <div class="flex flex-column gap-2">
            <label class="font-semibold text-sm">Daily Absent Cutoff Time (HH:mm:ss)</label>
            <input type="text" pInputText formControlName="arrivalCutoffTime" placeholder="17:00:00" />
          </div>
        </form>

        <ng-template pTemplate="footer">
          <p-button
            label="Cancel"
            severity="secondary"
            [outlined]="true"
            (onClick)="editVisible = false"
          ></p-button>
          <p-button
            label="Save"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="form.invalid || saving()"
            (onClick)="save()"
          ></p-button>
        </ng-template>
      </p-dialog>
    </div>
  `
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
