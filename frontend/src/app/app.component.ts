import { Component, ElementRef, inject, ViewChild } from '@angular/core'
import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http'
import { FormsModule } from '@angular/forms'

import MP3Tag from 'mp3tag.js'
import JSZip from 'jszip'

import { FileModel } from './models/file.model'
import { ResponseModel } from './models/response.model'
import { ApiService } from './services/api.service'

@Component({
  selector: 'app-root',
  standalone: true,
  providers: [HttpClient],
  imports: [FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>

  files: FileModel[] = []

  isFirstRequest = true
  isDownloadingAll = false
  requestStarted = false
  isDragging = false
  issueMessage = ''

  #apiService = inject(ApiService)

  onInputClick(): void {
    if (!this.requestStarted) {
      this.fileInput.nativeElement.click()
    }
  }

  swapArtistTitle(file: FileModel): void {
    [file.artist, file.title] = [file.title, file.artist]
  }

  onDragOver(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.isDragging = !this.requestStarted
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    this.isDragging = false
  }

  onDrop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    if (!this.requestStarted) {
      this.isDragging = false

      const files = event.dataTransfer?.files

      if (files) {
        this.#handleFiles(Array.from(files))
      }
    }
  }

  onInputSelect(event: Event): void {
    const input = event.target as HTMLInputElement

    if (input.files) {
      this.#handleFiles(Array.from(input.files))
    }
  }

  async downloadAll(): Promise<void> {
    this.isDownloadingAll = true

    const zip = new JSZip()

    for (const file of this.files) {
      await this.#writeTags(file)

      zip.file(`${this.buildName(file)}.mp3`, file.content)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })

    this.#createDownloadLink(zipBlob, 'mp3-bundle.zip');

    setTimeout(() => this.isDownloadingAll = false, 500)
  }

  async downloadFile(file: FileModel): Promise<void> {
    await this.#writeTags(file)

    this.#createDownloadLink(file.content, `${this.buildName(file)}.mp3`)
  }

  buildName(file: FileModel): string {
    return [file.artist, file.title].filter(Boolean).join(' - ')
  }

  async #writeTags(file: FileModel): Promise<void> {
    const arrayBuffer = await file.content?.arrayBuffer()

    if (!arrayBuffer) {
      return
    }

    const mp3tag = new MP3Tag(arrayBuffer)

    mp3tag.read()

    mp3tag.tags.title = file.title.trim() ?? ''
    mp3tag.tags.artist = file.artist.trim() ?? ''

    mp3tag.save()

    file.downloaded = true
    file.content = new Blob([mp3tag.buffer as ArrayBuffer], { type: file.type })
  }

  #handleFiles(files: File[]): void {
    this.issueMessage = ''
    this.requestStarted = true
    this.files = []

    for (const file of files) {
      if (file.type === 'audio/mpeg') {
        this.files.push({
          ...new FileModel(),
          content: file,
          type: file.type,
          original_name: file.name.replaceAll('.mp3', ''),
        })
      } else {
        this.issueMessage = 'Only MP3 files are supported.'
      }
    }

    if (this.files.length && this.issueMessage) {
      this.issueMessage = 'Some files are ignored. Only MP3 is supported.'
    }

    if (this.files.length) {
      this.#startRequest()
    } else {
      this.requestStarted = false
    }
  }

  #createDownloadLink(content: Blob | MediaSource, fileName: string): void {
    const link = document.createElement('a')

    link.href = URL.createObjectURL(content)
    link.download = fileName
    link.click()

    URL.revokeObjectURL(link.href)
  }

  #startRequest(): void {
    this.isFirstRequest = false

    const names = this.files.map(f => f.original_name)

    this.#apiService.parse(names)
      .subscribe({
        next: (response: ResponseModel[]) => {
          this.files = this.files.map((file: FileModel, index: number) => ({
            ...file,
            artist: response[index]?.artist.trim() ?? '',
            title: response[index]?.title.trim() ?? ''
          }))

          // Show the fancy animation a bit more :)
          setTimeout(() => this.requestStarted = false, 1000)
        },
        error: (error: HttpErrorResponse) => {
          this.issueMessage = error.status === HttpStatusCode.TooManyRequests
            ? 'Too many requests. Please try again later :)'
            : 'Some problems occurred :(';

          this.requestStarted = false
        }
      })
  }
}
