import { Component, computed, input, OnInit } from '@angular/core';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss'
})
export class ToastComponent implements OnInit {
  text = input.required<string>();
  type = input<string>('success');
  withClose = input<boolean>(true);

  id = computed(() => `toast-${this.type()}`);

  showToast = true;

  ngOnInit(): void {
    setTimeout(() => {
      this.showToast = false;
    }, 5000);
  }

  hideToast(): void {
    this.showToast = false;
  }
}
