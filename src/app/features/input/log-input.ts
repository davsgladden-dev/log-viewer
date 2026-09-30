import { Component, inject, signal } from '@angular/core';
import { LogStore } from '../../core/state/log-store';

@Component({
  selector: 'app-log-input',
  templateUrl: './log-input.html',
  styleUrl: './log-input.scss',
})
export class LogInput {
  private readonly store = inject(LogStore);

  protected readonly pasteText = signal('');
  protected readonly dragOver = signal(false);

  protected loadPasted(): void {
    this.store.load(this.pasteText(), 'pasted text');
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) await this.loadFile(file);
  }

  protected async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await this.loadFile(file);
    input.value = '';
  }

  private async loadFile(file: File): Promise<void> {
    const text = await file.text();
    this.store.load(text, file.name);
  }
}
