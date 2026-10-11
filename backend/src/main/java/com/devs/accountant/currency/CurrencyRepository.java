package com.devs.accountant.currency;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CurrencyRepository extends JpaRepository<Currency, Long>, JpaSpecificationExecutor<Currency> {

    List<Currency> findByStatusOrderByName(CurrencyStatus status);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    boolean existsByIsoIgnoreCaseAndIdNot(String iso, Long id);
}
