class GetReservationRequestsResponseDto {
  constructor(data, totalRecords, page, perPage) {
    this.data = data;
    this.pagination = {
      total_records: totalRecords,
      page,
      per_page: perPage,
    };
  }
}

module.exports = GetReservationRequestsResponseDto;
