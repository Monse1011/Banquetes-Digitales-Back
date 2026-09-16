class CreateReservationResponseDto {
  constructor(folio) {
    this.data = [
      {
        folio: folio,
      },
    ];
  }
}

module.exports = CreateReservationResponseDto;
