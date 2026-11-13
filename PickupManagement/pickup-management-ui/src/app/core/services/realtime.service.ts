import { Injectable, OnDestroy, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface QueueUpdatedEvent {
  ticketId: string;
  eventType: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private operationsConnection: signalR.HubConnection | null = null;
  private displayConnection: signalR.HubConnection | null = null;

  private readonly queueSubject = new Subject<QueueUpdatedEvent>();
  private readonly displaySubject = new Subject<void>();

  readonly queueUpdated$ = this.queueSubject.asObservable();
  readonly displayChanged$ = this.displaySubject.asObservable();

  async connectOperations(): Promise<void> {
    if (this.operationsConnection) {
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => this.authService.token() ?? ''
      })
      .withAutomaticReconnect()
      .build();

    connection.on('QueueUpdated', (payload: QueueUpdatedEvent) => {
      this.queueSubject.next(payload);
    });

    connection.onreconnected(async () => {
      await connection.invoke('JoinOperations');
    });

    this.operationsConnection = connection;
    try {
      await connection.start();
      await connection.invoke('JoinOperations');
    } catch (err) {
      console.error('SignalR operations connection error:', err);
    }
  }

  async connectPublicDisplay(): Promise<void> {
    if (this.displayConnection) {
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => this.authService.token() ?? ''
      })
      .withAutomaticReconnect()
      .build();

    connection.on('DisplayStateChanged', () => {
      this.displaySubject.next();
    });

    connection.onreconnected(async () => {
      await connection.invoke('JoinPublicDisplay');
      this.displaySubject.next();
    });

    this.displayConnection = connection;
    try {
      await connection.start();
      await connection.invoke('JoinPublicDisplay');
    } catch (err) {
      console.error('SignalR display connection error:', err);
    }
  }

  ngOnDestroy(): void {
    void this.operationsConnection?.stop();
    void this.displayConnection?.stop();
  }
}
