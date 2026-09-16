class CreateReservationResponseDto {
  constructor(folio) {
    this.data = [
      {
        folio,
      },
    ];
  }
}

module.exports = CreateReservationResponseDto;
