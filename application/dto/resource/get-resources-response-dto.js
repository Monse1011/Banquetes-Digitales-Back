class GetResourcesResponseDto {
  constructor(resources, totalRecords, page, perPage) {
    this.data = { resources };
    this.metadata = {
      pagination: {
        total_records: totalRecords,
        page,
        per_page: perPage,
      },
    };
  }
}

module.exports = GetResourcesResponseDto;
